import { NextResponse } from "next/server";
import { mcpIssuer, mcpResourceUrl } from "@/lib/mcp/origin";
import { corsPreflight, oauthCorsHeaders } from "@/lib/mcp/cors";
import { ISSUED_SCOPES } from "@/lib/mcp/tokens";

export function GET() {
  const issuer = mcpIssuer();
  return NextResponse.json(
    {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      registration_endpoint: `${issuer}/oauth/register`,
      userinfo_endpoint: `${issuer}/oauth/userinfo`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
      scopes_supported: [...ISSUED_SCOPES],
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true,
      resource: mcpResourceUrl(),
    },
    { headers: oauthCorsHeaders }
  );
}

export function OPTIONS() {
  return corsPreflight();
}
