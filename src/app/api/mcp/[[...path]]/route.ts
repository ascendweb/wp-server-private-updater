import { NextRequest } from "next/server";
import { withMcpAuth } from "mcp-handler";
import { mcpHandler } from "@/lib/mcp/server";
import { MCP_READ_SCOPE, verifyAccessToken } from "@/lib/mcp/tokens";
import { mcpResourceUrl } from "@/lib/mcp/origin";
import { corsPreflight, withCors } from "@/lib/mcp/cors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const authed = withMcpAuth(
  mcpHandler,
  async (_req, bearerToken) => {
    if (!bearerToken) return undefined;
    return verifyAccessToken(bearerToken);
  },
  {
    required: true,
    requiredScopes: [MCP_READ_SCOPE],
    resourceMetadataPath: "/.well-known/oauth-protected-resource",
    resourceUrl: mcpResourceUrl(),
  }
);

async function handle(req: NextRequest) {
  return withCors(await authed(req));
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function DELETE(req: NextRequest) {
  return handle(req);
}

export function OPTIONS() {
  return corsPreflight();
}
