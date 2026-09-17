import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { corsPreflight, oauthCorsHeaders } from "@/lib/mcp/cors";
import { mcpResourceUrl } from "@/lib/mcp/origin";
import {
  issueRefreshToken,
  parseScopeString,
  pkceChallenge,
  rotateRefreshToken,
  signAccessToken,
  signIdToken,
  timingSafeStringEqual,
  verifyClientSecret,
} from "@/lib/mcp/tokens";

function oauthError(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: oauthCorsHeaders }
  );
}

async function readTokenBody(req: NextRequest): Promise<URLSearchParams> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = (await req.json()) as Record<string, unknown>;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(json)) {
      if (typeof value === "string") params.set(key, value);
    }
    return params;
  }
  return new URLSearchParams(await req.text());
}

function decodeBasicAuth(header: string | null): { clientId: string; secret: string } | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return null;
    return { clientId: decoded.slice(0, idx), secret: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const body = await readTokenBody(req);
  const basic = decodeBasicAuth(req.headers.get("authorization"));
  const clientId = basic?.clientId || body.get("client_id") || "";
  const clientSecret = basic?.secret || body.get("client_secret") || "";
  const grantType = body.get("grant_type") || "";

  if (!clientId) {
    return oauthError("invalid_client", "client_id is required", 401);
  }

  const client = await prisma.mcpOAuthClient.findUnique({ where: { clientId } });
  if (!client) {
    return oauthError("invalid_client", "Unknown client", 401);
  }

  if (client.clientSecret) {
    if (!clientSecret || !verifyClientSecret(clientSecret, client.clientSecret)) {
      return oauthError("invalid_client", "Invalid client secret", 401);
    }
  } else if (clientSecret) {
    return oauthError("invalid_client", "This client does not use a secret", 401);
  }

  if (grantType === "authorization_code") {
    const code = body.get("code") || "";
    const redirectUri = body.get("redirect_uri") || "";
    const verifier = body.get("code_verifier") || "";
    const resource = body.get("resource") || mcpResourceUrl();

    if (!code || !redirectUri || !verifier) {
      return oauthError("invalid_request", "code, redirect_uri, and code_verifier are required");
    }

    const record = await prisma.mcpAuthorizationCode.findUnique({
      where: { code },
      include: { user: { select: { id: true, email: true, status: true } } },
    });
    if (!record || record.clientId !== client.clientId) {
      return oauthError("invalid_grant", "Invalid authorization code");
    }

    await prisma.mcpAuthorizationCode.delete({ where: { code } });

    if (record.expiresAt < new Date()) {
      return oauthError("invalid_grant", "Authorization code expired");
    }
    if (record.redirectUri !== redirectUri) {
      return oauthError("invalid_grant", "redirect_uri mismatch");
    }
    if (!timingSafeStringEqual(pkceChallenge(verifier), record.codeChallenge)) {
      return oauthError("invalid_grant", "PKCE verification failed");
    }
    if (record.user.status === "disabled") {
      return oauthError("invalid_grant", "User is disabled");
    }
    if (record.resource && record.resource !== resource) {
      return oauthError("invalid_grant", "resource mismatch");
    }

    const { token, expiresAt } = await signAccessToken({
      sub: record.userId,
      clientId: client.clientId,
      scopes: record.scopes,
      email: record.user.email,
    });

    const payload: Record<string, unknown> = {
      access_token: token,
      token_type: "Bearer",
      expires_in: expiresAt - Math.floor(Date.now() / 1000),
      scope: record.scopes.join(" "),
    };

    if (record.scopes.includes("offline_access")) {
      payload.refresh_token = await issueRefreshToken({
        clientId: client.clientId,
        userId: record.userId,
        scopes: record.scopes,
      });
    }
    if (record.scopes.includes("openid") && record.user.email) {
      payload.id_token = await signIdToken({
        sub: record.userId,
        clientId: client.clientId,
        email: record.user.email,
      });
    }

    return NextResponse.json(payload, { headers: oauthCorsHeaders });
  }

  if (grantType === "refresh_token") {
    const presented = body.get("refresh_token") || "";
    if (!presented) {
      return oauthError("invalid_request", "refresh_token is required");
    }
    const existing = await rotateRefreshToken(presented);
    if (!existing || existing.clientId !== client.clientId) {
      return oauthError("invalid_grant", "Invalid refresh token");
    }

    const sub = existing.userId || `client:${client.clientId}`;
    const { token, expiresAt } = await signAccessToken({
      sub,
      clientId: client.clientId,
      scopes: existing.scopes,
      email: existing.user?.email,
    });
    const refresh = await issueRefreshToken({
      clientId: client.clientId,
      userId: existing.userId,
      scopes: existing.scopes,
    });

    const payload: Record<string, unknown> = {
      access_token: token,
      token_type: "Bearer",
      expires_in: expiresAt - Math.floor(Date.now() / 1000),
      scope: existing.scopes.join(" "),
      refresh_token: refresh,
    };
    if (existing.scopes.includes("openid") && existing.user?.email) {
      payload.id_token = await signIdToken({
        sub,
        clientId: client.clientId,
        email: existing.user.email,
      });
    }
    return NextResponse.json(payload, { headers: oauthCorsHeaders });
  }

  if (grantType === "client_credentials") {
    if (client.type !== "service" || !client.clientSecret) {
      return oauthError("unauthorized_client", "Client is not allowed to use client_credentials");
    }
    const scopes = parseScopeString(body.get("scope"));
    const { token, expiresAt } = await signAccessToken({
      sub: `client:${client.clientId}`,
      clientId: client.clientId,
      scopes,
    });
    return NextResponse.json(
      {
        access_token: token,
        token_type: "Bearer",
        expires_in: expiresAt - Math.floor(Date.now() / 1000),
        scope: scopes.join(" "),
      },
      { headers: oauthCorsHeaders }
    );
  }

  return oauthError("unsupported_grant_type", `Unsupported grant_type: ${grantType}`);
}

export function OPTIONS() {
  return corsPreflight();
}
