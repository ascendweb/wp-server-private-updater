import { prisma } from "./db";
import type { CommandType, Command } from "@prisma/client";

export const SITE_COMMAND_TYPES = new Set<CommandType>(["refresh", "purge_cache"]);

export function isSiteCommand(type: CommandType | string): boolean {
  return SITE_COMMAND_TYPES.has(type as CommandType);
}

export function serializeCommand(command: Command) {
  return {
    id: command.id,
    siteId: command.siteId,
    type: command.type,
    pluginSlug: command.pluginSlug,
    targetVersion: command.targetVersion,
    status: command.status,
    result: command.result,
    createdAt: command.createdAt.toISOString(),
    completedAt: command.completedAt?.toISOString() ?? null,
  };
}

export function serializePendingCommand(command: Command) {
  const payload: {
    id: string;
    type: CommandType;
    plugin_slug?: string;
    target_version?: string | null;
    package_url?: string | null;
  } = {
    id: command.id,
    type: command.type,
  };

  if (!isSiteCommand(command.type) && command.pluginSlug) {
    payload.plugin_slug = command.pluginSlug;
    payload.target_version = command.targetVersion;
    payload.package_url = command.packageUrl;
  }

  return payload;
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
    where: { pluginSlug, siteId: { in: siteIds }, ...(type ? { type } : {}) },
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

export async function createCommand(
  siteId: string,
  type: CommandType,
  pluginSlug?: string | null,
  targetVersion?: string | null,
  packageUrl?: string | null
): Promise<Command> {
  return prisma.command.create({
    data: {
      siteId,
      type,
      pluginSlug: isSiteCommand(type) ? null : pluginSlug || null,
      targetVersion: isSiteCommand(type) ? null : targetVersion ?? null,
      packageUrl: isSiteCommand(type) ? null : packageUrl ?? null,
      status: "pending",
    },
  });
}

/**
 * Ping the site's REST endpoint so it polls for pending commands immediately.
 * The site verifies the site token, then calls back via POST /api/v1/commands/poll.
 *
 * 409 means an upgrade is already running — not a failed dispatch.
 * A timeout means the site may still be working (ignore_user_abort); results
 * arrive on /api/v1/commands/{id}/result.
 */
export type PingResult = {
  reached: boolean;
  busy: boolean;
  timedOut: boolean;
};

async function pingSite(siteUrl: string, siteToken: string): Promise<PingResult> {
  const { createHmac } = await import("crypto");
  const base = siteUrl.replace(/\/+$/, "");
  const pingUrl = `${base}/wp-admin/admin-post.php`;

  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = createHmac("sha256", siteToken).update(ts).digest("hex");

  try {
    const response = await fetch(pingUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `action=wppu_ping&ts=${ts}&sig=${sig}`,
      signal: AbortSignal.timeout(90_000),
    });

    if (response.status === 409) {
      return { reached: true, busy: true, timedOut: false };
    }

    const contentType = response.headers.get("content-type") || "";
    return {
      reached: response.ok && contentType.includes("application/json"),
      busy: false,
      timedOut: false,
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const timedOut = name === "TimeoutError" || name === "AbortError";
    return { reached: false, busy: false, timedOut };
  }
}

export type CommandSpec = {
  type: CommandType;
  pluginSlug?: string | null;
  targetVersion?: string | null;
  packageUrl?: string | null;
};

/**
 * Create many commands for one site, then ping once so the site polls the full batch.
 */
export async function createAndDispatchMany(
  siteId: string,
  items: CommandSpec[]
): Promise<Command[]> {
  if (items.length === 0) {
    return [];
  }

  const created: Command[] = [];
  for (const item of items) {
    created.push(
      await createCommand(
        siteId,
        item.type,
        item.pluginSlug,
        item.targetVersion,
        item.packageUrl
      )
    );
  }

  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
  if (site.siteToken) {
    await pingSite(site.url, site.siteToken);
  }

  return prisma.command.findMany({
    where: { id: { in: created.map((c) => c.id) } },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Create a command and attempt to ping the site to process it immediately.
 * If the ping fails, the command stays pending for the site's next check-in.
 */
export async function createAndDispatch(
  siteId: string,
  type: CommandType,
  pluginSlug?: string | null,
  targetVersion?: string | null,
  packageUrl?: string | null
): Promise<Command> {
  const commands = await createAndDispatchMany(siteId, [
    { type, pluginSlug, targetVersion, packageUrl },
  ]);
  const command = commands[0];
  if (!command) {
    throw new Error("Failed to create command.");
  }
  return command;
}
