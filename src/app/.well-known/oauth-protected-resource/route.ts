import { protectedResourceHandler, metadataCorsOptionsRequestHandler } from "mcp-handler";
import { mcpIssuer, mcpResourceUrl } from "@/lib/mcp/origin";

const handler = protectedResourceHandler({
  authServerUrls: [mcpIssuer()],
  resourceUrl: mcpResourceUrl(),
});

const corsHandler = metadataCorsOptionsRequestHandler();

export function GET(req: Request) {
  return handler(req);
}

export function OPTIONS() {
  return corsHandler();
}
