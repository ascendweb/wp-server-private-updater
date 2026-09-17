import { prisma } from "./db";
import type { CommandType, Command, CommandStatus, Prisma } from "@prisma/client";
import { isSiteArchived } from "./site-status";
import { getServerOriginFromEnv } from "./utils";
import { getPluginLatestRelease } from "./plugin-release";

export const SITE_COMMAND_TYPES = new Set<CommandType>(["refresh", "purge_cache"]);
export const RPC_COMMAND_TYPES = new Set<CommandType>(["list_tools", "call_ability"]);
const PACKAGE_COMMAND_TYPES = new Set<CommandType>(["update", "install", "rollback"]);

export function isSiteCommand(type: CommandType | string): boolean {
  return SITE_COMMAND_TYPES.has(type as CommandType);
}

export function isRpcCommand(type: CommandType | string): boolean {
  return RPC_COMMAND_TYPES.has(type as CommandType);
}

export function commandPayloadRecord(command: Pick<Command, "payload">): Record<string, unknown> {
  const value = command.payload;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function commandPluginSlug(command: Pick<Command, "payload">): string | null {
  const slug = commandPayloadRecord(command).pluginSlug;
  return typeof slug === "string" && slug ? slug : null;
}

export function commandTargetVersion(command: Pick<Command, "payload">): string | null {
  const version = commandPayloadRecord(command).targetVersion;
  return typeof version === "string" && version ? version : null;
}

export function commandSubject(command: Pick<Command, "type" | "payload">): string | null {
  const payload = commandPayloadRecord(command);
  if (typeof payload.pluginSlug === "string" && payload.pluginSlug) return payload.pluginSlug;
  if (typeof payload.ability === "string" && payload.ability) return payload.ability;
  return null;
}

export function serializeCommand(command: Command) {
  return {
    id: command.id,
    siteId: command.siteId,
    type: command.type,
    pluginSlug: commandSubject(command),
    targetVersion: commandTargetVersion(command),
    payload: command.payload,
    schedule: command.schedule,
    status: command.status,
    result: command.result,
    createdAt: command.createdAt.toISOString(),
    completedAt: command.completedAt?.toISOString() ?? null,
  };
}

export async function serializeClaimedCommand(
  command: Command,
  site: { url: string },
  licenseKey?: string | null
) {
  const claimed: {
    id: string;
    type: CommandType;
    payload: Prisma.JsonValue;
    plugin_slug?: string;
    target_version?: string | null;
    package_url?: string | null;
  } = {
    id: command.id,
    type: command.type,
    payload: command.payload,
  };

  const slug = commandPluginSlug(command);
  if (slug) {
    claimed.plugin_slug = slug;
    claimed.target_version = commandTargetVersion(command);
  }

  if (slug && licenseKey && PACKAGE_COMMAND_TYPES.has(command.type)) {
    claimed.package_url = await packageUrlFor(slug, claimed.target_version, licenseKey, site.url);
  }

  return claimed;
}

async function packageUrlFor(
  slug: string,
  targetVersion: string | null | undefined,
  licenseKey: string,
  siteUrl: string
) {
  let version = targetVersion || null;
  if (!version) {
    const plugin = await prisma.plugin.findUnique({ where: { slug } });
    if (plugin) {
      try {
        const release = await getPluginLatestRelease(plugin);
        version = release?.version ?? null;
      } catch {
        version = null;
      }
    }
  }
  if (!version) return null;
  const origin = getServerOriginFromEnv();
  return `${origin}/api/v1/download/${slug}/${version}?license_key=${encodeURIComponent(licenseKey)}&site_url=${encodeURIComponent(siteUrl)}`;
}

export async function latestCommandsBySite(
  pluginSlug: string,
  siteIds: string[],
  type?: CommandType
) {
  if (siteIds.length === 0) {
    return new Map<string, Command>();
  }

  const commands = await prisma.command.findMany({
    where: {
      siteId: { in: siteIds },
      ...(type ? { type } : {}),
      payload: { path: ["pluginSlug"], equals: pluginSlug },
    },
    orderBy: { createdAt: "desc" },
  });

  const latestBySite = new Map<string, Command>();
  for (const command of commands) {
    if (!latestBySite.has(command.siteId)) {
      latestBySite.set(command.siteId, command);
    }
  }

  return latestBySite;
}

export const COMMAND_TIMEOUT_MS = 60 * 60 * 1000;

const STALE_COMMAND_STATUSES: CommandStatus[] = ["pending", "delivered", "in_progress"];

/** Mark inflight commands older than one hour as failed. */
export async function expireStaleCommands() {
  const cutoff = new Date(Date.now() - COMMAND_TIMEOUT_MS);
  await prisma.command.updateMany({
    where: {
      status: { in: STALE_COMMAND_STATUSES },
      createdAt: { lt: cutoff },
    },
    data: {
      status: "failed",
      completedAt: new Date(),
      result: { message: "Command timed out after 1 hour" },
    },
  });
}

export async function createCommand(
  siteId: string,
  type: CommandType,
  payload: Record<string, unknown> = {}
): Promise<Command> {
  return prisma.command.create({
    data: {
      siteId,
      type,
      payload: payload as Prisma.InputJsonValue,
      schedule: !isRpcCommand(type),
      status: "pending",
    },
  });
}

/**
 * Ping the site so it polls for pending commands immediately. The site verifies
 * the HMAC, then calls back via POST /api/v1/commands/poll.
 *
 * This must hit the site's front page rather than a /wp-admin/ endpoint. Managed
 * hosts (WP Engine) decide whether a request is allowed to write .php files
 * before any plugin code runs, and an anonymous POST to wp-admin is refused —
 * plugin updates then fail part-way through unzipping. The plugin promotes the
 * front-end request to an administrator itself. ManageWP and MainWP work the
 * same way.
 *
 * When commandId is set, the HMAC covers that id and the site runs only that
 * command. 409 means an upgrade is already running — not a failed dispatch.
 */
export type PingResult = {
  reached: boolean;
  busy: boolean;
  timedOut: boolean;
  ok: boolean;
  message?: string;
  wpeAuth?: string;
  commandResult?: unknown;
};

type PingSiteOptions = {
  cookiesOnly?: boolean;
  commandId?: string;
};

async function pingSite(
  siteUrl: string,
  siteToken: string,
  wpeAuth?: string | null,
  options: PingSiteOptions | boolean = {}
): Promise<PingResult> {
  const opts: PingSiteOptions = typeof options === "boolean" ? { cookiesOnly: options } : options;
  const { createHmac } = await import("crypto");
  const pingUrl = `${siteUrl.replace(/\/+$/, "")}/`;

  const ts = Math.floor(Date.now() / 1000).toString();
  const commandId = opts.commandId?.trim() || "";
  const signed = commandId ? `ping:${ts}:${commandId}` : `ping:${ts}`;
  const sig = createHmac("sha256", siteToken).update(signed).digest("hex");

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (wpeAuth) {
    headers.Cookie = `wpe-auth=${wpeAuth}`;
  }

  const body = new URLSearchParams({
    wppu_action: "ping",
    ts,
    sig,
  });
  if (commandId) body.set("command_id", commandId);
  if (opts.cookiesOnly) body.set("wppu_cookies", "1");

  try {
    const response = await fetch(pingUrl, {
      method: "POST",
      headers,
      body: body.toString(),
      signal: AbortSignal.timeout(90_000),
    });

    if (response.status === 409) {
      return { reached: true, busy: true, timedOut: false, ok: false, message: "Site is busy with another update." };
    }

    const handled =
      response.headers.get("x-wppu-handled") === "1" ||
      (response.headers.get("content-type") || "").includes("application/json");

    let returnedAuth: string | undefined;
    let commandResult: unknown;
    let message: string | undefined;
    let pingOk = response.ok && handled;
    try {
      const payload = (await response.json()) as {
        success?: unknown;
        data?: { wpe_auth?: unknown; result?: unknown };
        message?: unknown;
      };
      if (typeof payload.data?.wpe_auth === "string" && payload.data.wpe_auth) {
        returnedAuth = payload.data.wpe_auth;
      }
      if ("result" in (payload.data || {})) {
        commandResult = payload.data?.result;
      }
      if (typeof payload.message === "string") {
        message = payload.message;
      }
      if (payload.success === false) {
        pingOk = false;
        if (!message && typeof payload.data === "string") {
          message = payload.data;
        }
      }
    } catch {
      // Home-page HTML when the plugin did not handle the ping.
    }

    return {
      reached: handled,
      busy: false,
      timedOut: false,
      ok: pingOk,
      message,
      wpeAuth: returnedAuth,
      commandResult,
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const timedOut = name === "TimeoutError" || name === "AbortError";
    return {
      reached: false,
      busy: false,
      timedOut,
      ok: false,
      message: timedOut ? "Timed out waiting for the site." : "Could not reach the site.",
    };
  }
}

async function rememberWpeAuth(siteId: string, wpeAuth: string | undefined) {
  if (!wpeAuth) {
    return;
  }
  await prisma.site.update({
    where: { id: siteId },
    data: { wpeAuth },
  });
}

/**
 * Ping the site with no commands so it returns its WP Engine write cookie.
 * Does not wait on heartbeat or cron.
 */
export async function reloadSiteHostCookies(siteId: string): Promise<{
  reached: boolean;
  stored: boolean;
}> {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
  if (!site.siteToken) {
    throw new Error("Site has no token yet.");
  }

  const result = await pingSite(site.url, site.siteToken, site.wpeAuth, { cookiesOnly: true });
  await rememberWpeAuth(siteId, result.wpeAuth);

  return {
    reached: result.reached,
    stored: Boolean(result.wpeAuth),
  };
}

export type CommandSpec = {
  type: CommandType;
  payload?: Record<string, unknown>;
  pluginSlug?: string | null;
  targetVersion?: string | null;
};

function specPayload(item: CommandSpec): Record<string, unknown> {
  if (item.payload) return item.payload;
  const payload: Record<string, unknown> = {};
  if (item.pluginSlug) payload.pluginSlug = item.pluginSlug;
  if (item.targetVersion) payload.targetVersion = item.targetVersion;
  return payload;
}

/**
 * Create many scheduled commands for one site, then ping once so the site
 * drains pending jobs (not RPC rows).
 */
export async function createAndDispatchMany(
  siteId: string,
  items: CommandSpec[]
): Promise<Command[]> {
  if (items.length === 0) {
    return [];
  }

  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
  if (isSiteArchived(site)) {
    throw new Error("Site is archived");
  }

  const created: Command[] = [];
  for (const item of items) {
    if (isRpcCommand(item.type)) {
      throw new Error("RPC commands must use createAndDispatchRpc");
    }
    created.push(await createCommand(siteId, item.type, specPayload(item)));
  }

  if (site.siteToken) {
    const ping = await pingSite(site.url, site.siteToken, site.wpeAuth);
    await rememberWpeAuth(siteId, ping.wpeAuth);
  }

  return prisma.command.findMany({
    where: { id: { in: created.map((c) => c.id) } },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Create a job command and ping the site to drain scheduled work.
 * If the ping fails, the command stays pending for the scheduled poll.
 */
export async function createAndDispatch(
  siteId: string,
  type: CommandType,
  pluginSlug?: string | null,
  targetVersion?: string | null
): Promise<Command> {
  const commands = await createAndDispatchMany(siteId, [
    { type, pluginSlug, targetVersion },
  ]);
  const command = commands[0];
  if (!command) {
    throw new Error("Failed to create command.");
  }
  return command;
}

export class RpcDispatchError extends Error {
  constructor(
    message: string,
    readonly code: "busy" | "timeout" | "unreachable" | "failed" = "failed"
  ) {
    super(message);
    this.name = "RpcDispatchError";
  }
}

/**
 * Create an RPC command, ping that id, and wait for the site's ping JSON.
 * The scheduled poll never sees these rows.
 */
export async function createAndDispatchRpc(
  siteId: string,
  type: CommandType,
  payload: Record<string, unknown> = {}
): Promise<{ command: Command; output: unknown }> {
  if (!isRpcCommand(type)) {
    throw new Error("createAndDispatchRpc requires an RPC command type");
  }

  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
  if (isSiteArchived(site)) {
    throw new Error("Site is archived");
  }
  if (!site.siteToken) {
    throw new RpcDispatchError("Site has no token yet.", "unreachable");
  }

  const command = await createCommand(siteId, type, payload);
  const ping = await pingSite(site.url, site.siteToken, site.wpeAuth, { commandId: command.id });
  await rememberWpeAuth(siteId, ping.wpeAuth);

  if (ping.busy) {
    await failCommand(command.id, ping.message || "Site is busy with another update.");
    throw new RpcDispatchError(ping.message || "Site is busy with another update.", "busy");
  }

  if (ping.timedOut || !ping.ok) {
    const finished = await readFinishedRpc(command.id);
    if (finished) {
      if (!finished.success) {
        throw new RpcDispatchError(finished.message, "failed");
      }
      return { command: finished.command, output: finished.output };
    }
    const code = ping.timedOut ? "timeout" : "unreachable";
    const message = ping.message || (ping.timedOut ? "Timed out waiting for the site." : "Could not reach the site.");
    await failCommand(command.id, message);
    throw new RpcDispatchError(message, code);
  }

  const result =
    ping.commandResult && typeof ping.commandResult === "object"
      ? (ping.commandResult as Record<string, unknown>)
      : ping.commandResult === undefined
        ? null
        : { output: ping.commandResult };

  if (!result) {
    const finished = await readFinishedRpc(command.id);
    if (finished) {
      if (!finished.success) {
        throw new RpcDispatchError(finished.message, "failed");
      }
      return { command: finished.command, output: finished.output };
    }
    await failCommand(command.id, ping.message || "Site did not return a command result.");
    throw new RpcDispatchError(ping.message || "Site did not return a command result.", "failed");
  }

  const success = result.success !== false && result.isError !== true;
  await prisma.command.update({
    where: { id: command.id },
    data: {
      status: success ? "completed" : "failed",
      result: result as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });

  const updated = await prisma.command.findUniqueOrThrow({ where: { id: command.id } });
  if (!success) {
    const message =
      typeof result.message === "string" ? result.message : "Ability call failed on the site.";
    throw new RpcDispatchError(message, "failed");
  }

  return {
    command: updated,
    output: "output" in result ? result.output : result,
  };
}

function jsonRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

async function readFinishedRpc(id: string) {
  const command = await prisma.command.findUniqueOrThrow({ where: { id } });
  if (command.status !== "completed" && command.status !== "failed") {
    return null;
  }
  const stored = jsonRecord(command.result);
  return {
    command,
    success: command.status === "completed",
    output: "output" in stored ? stored.output : stored,
    message: typeof stored.message === "string" ? stored.message : "Ability call failed on the site.",
  };
}

async function failCommand(id: string, message: string) {
  await prisma.command.updateMany({
    where: { id, status: { in: ["pending", "delivered", "in_progress"] } },
    data: {
      status: "failed",
      completedAt: new Date(),
      result: { success: false, message },
    },
  });
}
