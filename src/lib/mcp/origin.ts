import { getServerOriginFromEnv } from "@/lib/utils";

export function mcpIssuer(): string {
  return getServerOriginFromEnv();
}

export function mcpResourceUrl(): string {
  return `${mcpIssuer()}/api/mcp`;
}

export function mcpJwtSecret(): Uint8Array {
  const secret = process.env.MCP_JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET or MCP_JWT_SECRET must be set");
  }
  return new TextEncoder().encode(secret);
}
