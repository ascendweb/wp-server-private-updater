export const MCP_SCOPES = ["mcp:read", "mcp:write"] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

export type AbilityShip = "v1" | "v2" | "later";
export type AbilityBackend = "db" | "queue" | "wp";
export type AbilityAccess = "read" | "write";

export type AbilityDef = {
  id: string;
  title: string;
  description: string;
  access: AbilityAccess;
  backend: AbilityBackend;
  ship: AbilityShip;
};

/** Catalog IDs stay WordPress-style `namespace/ability`. MCP wire names replace `/` with `-`, matching WordPress `McpNameSanitizer` and MCP 2025-11-25 (`A-Za-z0-9_.-`). */
export function toMcpToolName(id: string) {
  return id.replaceAll("/", "-");
}

export function fromMcpToolName(name: string) {
  if (name.includes("/")) return name;
  const underscore = name.indexOf("_");
  const hyphen = name.indexOf("-");
  const separator =
    underscore >= 0 && (hyphen < 0 || underscore < hyphen) ? underscore : hyphen;
  if (separator <= 0) return name;
  return `${name.slice(0, separator)}/${name.slice(separator + 1)}`;
}

export const ABILITIES: AbilityDef[] = [
  {
    id: "sites/list",
    title: "List sites",
    description:
      "List licensed WordPress sites in this registry. Optional query filters by URL or label. Defaults to active sites; pass status=archived for archived sites. Does not dump installed plugins — use site-get-plugins or platform-get-plugin-installs.",
    access: "read",
    backend: "db",
    ship: "v1",
  },
  {
    id: "sites/purge-cache",
    title: "Purge caches on sites",
    description: "Enqueue a cache purge on one or more sites (NitroPack / WP Engine).",
    access: "write",
    backend: "queue",
    ship: "v2",
  },
  {
    id: "site/get",
    title: "Get site",
    description: "Get one site by id or URL: label, status, last check-in, plugin count.",
    access: "read",
    backend: "db",
    ship: "v1",
  },
  {
    id: "site/get-plugins",
    title: "Get site plugins",
    description:
      "List plugins installed on one site (heartbeat inventory): slug, version, active, pinned, managed catalog latest version.",
    access: "read",
    backend: "db",
    ship: "v1",
  },
  {
    id: "site/get-commands",
    title: "Get site commands",
    description: "List the most recent remote commands queued for one site.",
    access: "read",
    backend: "db",
    ship: "v1",
  },
  {
    id: "site/refresh",
    title: "Refresh site inventory",
    description: "Ask the site to send a fresh plugin inventory heartbeat.",
    access: "write",
    backend: "queue",
    ship: "v2",
  },
  {
    id: "site/purge-cache",
    title: "Purge site cache",
    description: "Enqueue a cache purge on one site.",
    access: "write",
    backend: "queue",
    ship: "v2",
  },
  {
    id: "site/install-plugin",
    title: "Install plugin",
    description: "Enqueue an install of a managed plugin on one site.",
    access: "write",
    backend: "queue",
    ship: "v2",
  },
  {
    id: "site/update-plugin",
    title: "Update plugin",
    description: "Enqueue an update of a plugin on one site to latest or a given version.",
    access: "write",
    backend: "queue",
    ship: "v2",
  },
  {
    id: "site/rollback-plugin",
    title: "Rollback plugin",
    description: "Enqueue a rollback of a plugin on one site to a specific version.",
    access: "write",
    backend: "queue",
    ship: "v2",
  },
  {
    id: "site/activate-plugin",
    title: "Activate plugin",
    description: "Enqueue activation of a plugin on one site.",
    access: "write",
    backend: "queue",
    ship: "v2",
  },
  {
    id: "site/deactivate-plugin",
    title: "Deactivate plugin",
    description: "Enqueue deactivation of a plugin on one site.",
    access: "write",
    backend: "queue",
    ship: "v2",
  },
  {
    id: "site/list-tools",
    title: "List site tools",
    description:
      "Discover WordPress abilities/MCP tools on one site (Rank Math, core, etc.). Returns original names such as rank-math/get-redirections. Then call them with site/call-tool. Not implemented until the worker exposes abilities.",
    access: "read",
    backend: "wp",
    ship: "later",
  },
  {
    id: "site/get-tool",
    title: "Get site tool schema",
    description: "Get the input/output schema for one ability on a site, by its original name.",
    access: "read",
    backend: "wp",
    ship: "later",
  },
  {
    id: "site/call-tool",
    title: "Call site tool",
    description:
      "Execute a WordPress ability on one site by original name (e.g. rank-math/get-redirections). Do not reimplement those tools here.",
    access: "write",
    backend: "wp",
    ship: "later",
  },
  {
    id: "platform/list-plugins",
    title: "List catalog plugins",
    description: "List plugins in this registry catalog (slug, name, latest version).",
    access: "read",
    backend: "db",
    ship: "v1",
  },
  {
    id: "platform/get-plugin-installs",
    title: "Get plugin installs",
    description: "Given a catalog plugin slug, list which sites have it installed and at what version.",
    access: "read",
    backend: "db",
    ship: "v1",
  },
  {
    id: "platform/get-command",
    title: "Get command",
    description: "Get one remote command by id (status, result, timestamps).",
    access: "read",
    backend: "db",
    ship: "v1",
  },
  {
    id: "platform/update-plugin",
    title: "Update plugin on sites",
    description: "Enqueue a plugin update across selected sites.",
    access: "write",
    backend: "queue",
    ship: "v2",
  },
  {
    id: "platform/add-site",
    title: "Add site",
    description: "Create or connect a licensed WordPress site to this registry.",
    access: "write",
    backend: "db",
    ship: "later",
  },
  {
    id: "platform/list-tags",
    title: "List tags",
    description: "List site tags. Tagging is not available yet.",
    access: "read",
    backend: "db",
    ship: "later",
  },
];

export const V1_ABILITIES = ABILITIES.filter((ability) => ability.ship === "v1");
