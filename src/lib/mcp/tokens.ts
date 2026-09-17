import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { hashSync, compareSync } from "bcryptjs";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/db";
import { mcpIssuer, mcpJwtSecret, mcpResourceUrl } from "./origin";

export const MCP_READ_SCOPE = "mcp:read";
export const ACCESS_TOKEN_TTL_SEC = 60 * 60;
export const AUTH_CODE_TTL_MS = 10 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const ISSUED_SCOPES = ["mcp:read", "offline_access", "openid", "email"] as const;

type AccessClaims = JWTPayload & {
  client_id?: string;
  scope?: string;
  email?: string;
};

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function parseScopeString(scope?: string | null): string[] {
  if (!scope) return [MCP_READ_SCOPE];
  const requested = scope.split(/[\s+]+/).filter(Boolean);
  const allowed = new Set<string>(ISSUED_SCOPES);
  const granted = requested.filter((item) => allowed.has(item));
  if (!granted.includes(MCP_READ_SCOPE)) {
    granted.unshift(MCP_READ_SCOPE);
  }
  return [...new Set(granted)];
}

export function hashClientSecret(secret: string): string {
  return hashSync(secret, 10);
}

export function verifyClientSecret(secret: string, hashed: string): boolean {
  return compareSync(secret, hashed);
}

export async function signAccessToken(input: {
  sub: string;
  clientId: string;
  scopes: string[];
  email?: string | null;
}): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SEC;
  const token = await new SignJWT({
    client_id: input.clientId,
    scope: input.scopes.join(" "),
    ...(input.email ? { email: input.email, email_verified: true } : {}),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(mcpIssuer())
    .setAudience(mcpResourceUrl())
    .setSubject(input.sub)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(mcpJwtSecret());
  return { token, expiresAt };
}

export async function signIdToken(input: {
  sub: string;
  clientId: string;
  email: string;
  nonce?: string;
}): Promise<string> {
  return new SignJWT({
    email: input.email,
    email_verified: true,
    ...(input.nonce ? { nonce: input.nonce } : {}),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(mcpIssuer())
    .setAudience(input.clientId)
    .setSubject(input.sub)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL_SEC + "s")
    .sign(mcpJwtSecret());
}

export async function verifyAccessToken(token: string): Promise<AuthInfo | undefined> {
  try {
    const { payload } = await jwtVerify(token, mcpJwtSecret(), {
      issuer: mcpIssuer(),
      audience: mcpResourceUrl(),
    });
    const claims = payload as AccessClaims;
    const scopes = typeof claims.scope === "string" ? claims.scope.split(" ").filter(Boolean) : [];
    if (!scopes.includes(MCP_READ_SCOPE)) return undefined;
    if (!claims.sub || !claims.exp) return undefined;

    return {
      token,
      clientId: typeof claims.client_id === "string" ? claims.client_id : "unknown",
      scopes,
      expiresAt: claims.exp,
      extra: {
        userId: claims.sub.startsWith("client:") ? undefined : claims.sub,
        email: claims.email,
      },
    };
  } catch {
    return undefined;
  }
}

export async function issueRefreshToken(input: {
  clientId: string;
  userId?: string | null;
  scopes: string[];
}): Promise<string> {
  const token = randomToken(48);
  await prisma.mcpRefreshToken.create({
    data: {
      tokenHash: sha256Hex(token),
      clientId: input.clientId,
      userId: input.userId || null,
      scopes: input.scopes,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return token;
}

export async function rotateRefreshToken(presented: string) {
  const hash = sha256Hex(presented);
  const existing = await prisma.mcpRefreshToken.findUnique({
    where: { tokenHash: hash },
    include: { user: { select: { id: true, email: true, status: true } } },
  });
  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    return null;
  }

  await prisma.mcpRefreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  if (existing.user && existing.user.status === "disabled") {
    return null;
  }

  return existing;
}

export type CimdMetadata = {
  client_id?: string;
  client_name?: string;
  redirect_uris?: string[];
  token_endpoint_auth_method?: string;
  token_endpoint_auth_methods_supported?: string[];
};

export function isCimdClientId(clientId: string): boolean {
  return /^https:\/\//i.test(clientId);
}

export async function fetchCimdMetadata(clientId: string): Promise<CimdMetadata | null> {
  try {
    const response = await fetch(clientId, {
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as CimdMetadata;
  } catch {
    return null;
  }
}

export function redirectUriAllowed(allowed: string[], requested: string): boolean {
  if (allowed.includes(requested)) return true;
  try {
    const url = new URL(requested);
    if (url.hostname === "chatgpt.com" && url.pathname.startsWith("/connector/oauth/")) {
      return allowed.some((item) => {
        try {
          const allowedUrl = new URL(item);
          return (
            allowedUrl.hostname === "chatgpt.com" &&
            allowedUrl.pathname.startsWith("/connector/oauth/")
          );
        } catch {
          return false;
        }
      });
    }
  } catch {
    return false;
  }
  return false;
}

export async function upsertPublicClient(input: {
  clientId: string;
  name: string;
  redirectUris: string[];
  tokenEndpointAuthMethod?: string;
}) {
  return prisma.mcpOAuthClient.upsert({
    where: { clientId: input.clientId },
    create: {
      clientId: input.clientId,
      name: input.name,
      type: "public",
      tokenEndpointAuthMethod: input.tokenEndpointAuthMethod || "none",
      redirectUris: input.redirectUris,
      scopes: [MCP_READ_SCOPE],
    },
    update: {
      name: input.name,
      redirectUris: input.redirectUris,
      tokenEndpointAuthMethod: input.tokenEndpointAuthMethod || "none",
    },
  });
}
