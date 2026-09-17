import { NextRequest } from "next/server";
import { fromMcpToolName } from "./abilities";
import { mcpIssuer } from "./origin";
import { MCP_READ_SCOPE, verifyAccessToken } from "./tokens";
import {
  McpQueryError,
  getCommand,
  getPluginInstalls,
  getSite,
  getSiteCommands,
  getSitePlugins,
  listCatalogPlugins,
  listSites,
} from "./queries";
import { callSiteTool, listSiteTools } from "./rpc";
import { RpcDispatchError } from "@/lib/commands";

function isJsonRpc(body: unknown): boolean {
  if (Array.isArray(body)) {
    return body.some((item) => item && typeof item === "object" && "jsonrpc" in item);
  }
  return Boolean(body && typeof body === "object" && "jsonrpc" in body);
}

function rewriteToolName(name: unknown) {
  if (typeof name !== "string" || !name.includes("/")) return name;
  return name.replaceAll("/", "-");
}

export function rewriteJsonRpcToolNames(body: unknown): unknown {
  const rewriteMessage = (message: Record<string, unknown>) => {
    if (message.method !== "tools/call") return message;
    const params = message.params;
    if (!params || typeof params !== "object" || Array.isArray(params)) return message;
    const paramsRecord = params as Record<string, unknown>;
    const nextName = rewriteToolName(paramsRecord.name);
    if (nextName === paramsRecord.name) return message;
    return { ...message, params: { ...paramsRecord, name: nextName } };
  };

  if (Array.isArray(body)) {
    let changed = false;
    const next = body.map((item) => {
      if (!item || typeof item !== "object") return item;
      const rewritten = rewriteMessage(item as Record<string, unknown>);
      if (rewritten !== item) changed = true;
      return rewritten;
    });
    return changed ? next : body;
  }

  if (!body || typeof body !== "object") return body;
  const rewritten = rewriteMessage(body as Record<string, unknown>);
  return rewritten === body ? body : rewritten;
}

export async function rewriteIncomingMcpRequest(req: NextRequest): Promise<NextRequest> {
  if (req.method !== "POST") return req;
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return req;

  let body: unknown;
  try {
    body = await req.clone().json();
  } catch {
    return req;
  }

  const rewritten = rewriteJsonRpcToolNames(body);
  if (rewritten === body) return req;

  const headers = new Headers(req.headers);
  headers.delete("content-length");
  return new NextRequest(req.url, {
    method: req.method,
    headers,
    body: JSON.stringify(rewritten),
  });
}

function unauthorized() {
  const metadata = `${mcpIssuer()}/.well-known/oauth-protected-resource`;
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": `Bearer FAKESECRET_g3h4i5j6k7l8m9n0o1p2="${metadata}"`,
    },
  });
}

function stringArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  return typeof value === "string" ? value : "";
}

function abilityArgs(args: Record<string, unknown>): Record<string, unknown> {
  const raw = args.arguments;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const json = JSON.parse(raw) as unknown;
      if (json && typeof json === "object" && !Array.isArray(json)) {
        return json as Record<string, unknown>;
      }
    } catch {
      // fall through to leftover query/body fields
    }
  }
  const extra = { ...args };
  delete extra.site;
  delete extra.ability;
  delete extra.arguments;
  return extra;
}

async function executeAbility(id: string, args: Record<string, unknown>) {
  switch (id) {
    case "sites/list": {
      const status = stringArg(args, "status");
      return listSites({
        query: stringArg(args, "query") || undefined,
        status: status === "archived" ? "archived" : status === "active" ? "active" : undefined,
      });
    }
    case "site/get":
      return getSite(stringArg(args, "site"));
    case "site/get-plugins":
      return getSitePlugins(stringArg(args, "site"));
    case "site/get-commands":
      return getSiteCommands(stringArg(args, "site"));
    case "platform/list-plugins":
      return listCatalogPlugins();
    case "platform/get-plugin-installs":
      return getPluginInstalls(stringArg(args, "plugin"));
    case "platform/get-command":
      return getCommand(stringArg(args, "command_id"));
    case "site/list-tools":
      return listSiteTools(stringArg(args, "site"));
    case "site/call-tool":
      return callSiteTool(stringArg(args, "site"), stringArg(args, "ability"), abilityArgs(args));
    default:
      return null;
  }
}

function argsFromSearch(req: NextRequest) {
  const args: Record<string, unknown> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    args[key] = value;
  });
  return args;
}

export async function tryRestMcp(req: NextRequest): Promise<Response | null> {
  const extra = req.nextUrl.pathname.replace(/^\/api\/mcp\/?/, "");
  if (!extra) return null;

  if (req.method === "POST") {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      let body: unknown;
      try {
        body = await req.clone().json();
      } catch {
        body = null;
      }
      if (isJsonRpc(body)) return null;
    }
  }

  if (req.method !== "GET" && req.method !== "POST") return null;

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
  const auth = token ? await verifyAccessToken(token) : undefined;
  if (!auth?.scopes.includes(MCP_READ_SCOPE)) {
    return unauthorized();
  }

  let args = argsFromSearch(req);
  if (req.method === "POST") {
    try {
      const body = await req.clone().json();
      if (body && typeof body === "object" && !Array.isArray(body)) {
        args = { ...args, ...(body as Record<string, unknown>) };
      }
    } catch {
      // keep query args
    }
  }

  try {
    const result = await executeAbility(fromMcpToolName(extra), args);
    if (result === null) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return Response.json(result);
  } catch (error) {
    const status =
      error instanceof RpcDispatchError
        ? 502
        : error instanceof McpQueryError && error.code === "bad_request"
          ? 400
          : 404;
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status });
  }
}
