import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { corsPreflight, oauthCorsHeaders } from "@/lib/mcp/cors";
import {
  fetchCimdMetadata,
  hashClientSecret,
  isCimdClientId,
  parseScopeString,
  randomToken,
  upsertPublicClient,
} from "@/lib/mcp/tokens";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: "JSON body required" },
      { status: 400, headers: oauthCorsHeaders }
    );
  }

  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
  if (redirectUris.length === 0) {
    return NextResponse.json(
      { error: "invalid_redirect_uri", error_description: "redirect_uris is required" },
      { status: 400, headers: oauthCorsHeaders }
    );
  }

  if (typeof body.client_id === "string" && isCimdClientId(body.client_id)) {
    const metadata = await fetchCimdMetadata(body.client_id);
    if (!metadata) {
      return NextResponse.json(
        { error: "invalid_client_metadata", error_description: "Could not fetch client_id metadata" },
        { status: 400, headers: oauthCorsHeaders }
      );
    }
    const client = await upsertPublicClient({
      clientId: body.client_id,
      name: metadata.client_name || body.client_name?.toString() || "CIMD client",
      redirectUris: metadata.redirect_uris?.length ? metadata.redirect_uris : redirectUris,
      tokenEndpointAuthMethod: "none",
    });
    return NextResponse.json(
      {
        client_id: client.clientId,
        client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
        redirect_uris: client.redirectUris,
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      },
      { headers: oauthCorsHeaders }
    );
  }

  const authMethod =
    typeof body.token_endpoint_auth_method === "string"
      ? body.token_endpoint_auth_method
      : "none";
  const confidential = authMethod === "client_secret_post" || authMethod === "client_secret_basic";
  const clientId = `dcr_${randomToken(18)}`;
  const secret = confidential ? randomToken(32) : null;

  const client = await prisma.mcpOAuthClient.create({
    data: {
      clientId,
      clientSecret: secret ? hashClientSecret(secret) : null,
      name:
        (typeof body.client_name === "string" && body.client_name) ||
        "Dynamically registered client",
      type: confidential ? "confidential" : "public",
      tokenEndpointAuthMethod: confidential ? authMethod : "none",
      redirectUris,
      scopes: parseScopeString(
        typeof body.scope === "string" ? body.scope : undefined
      ),
    },
  });

  return NextResponse.json(
    {
      client_id: client.clientId,
      client_secret: secret ?? undefined,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: client.tokenEndpointAuthMethod,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_name: client.name,
    },
    { status: 201, headers: oauthCorsHeaders }
  );
}

export function OPTIONS() {
  return corsPreflight();
}
