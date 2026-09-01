import { prisma } from "./db";
import type { CommandType, Command } from "@prisma/client";

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
  pluginSlug: string,
  targetVersion?: string | null,
  packageUrl?: string | null
): Promise<Command> {
  return prisma.command.create({
    data: {
      siteId,
      type,
      pluginSlug,
      targetVersion: targetVersion ?? null,
      packageUrl: packageUrl ?? null,
      status: "pending",
    },
  });
}

/**
 * Ping the site's REST endpoint so it polls for pending commands immediately.
 * The site verifies the site token, then calls back via POST /api/v1/commands/poll.
 * If the ping fails, the command stays pending for the site's next check-in.
 */
async function pingSite(siteUrl: string, siteToken: string): Promise<boolean> {
  const base = siteUrl.replace(/\/+$/, "");
  const pingUrl = `${base}/wp-json/wppu/v1/ping?token=${encodeURIComponent(siteToken)}`;

  try {
    const response = await fetch(pingUrl, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(90_000),
    });
    const contentType = response.headers.get("content-type") || "";
    return response.ok && contentType.includes("application/json");
  } catch {
    return false;
  }
}

/**
 * Create a command and attempt to ping the site to process it immediately.
 * If the ping fails, the command stays pending for the site's next check-in.
 */
export async function createAndDispatch(
  siteId: string,
  type: CommandType,
  pluginSlug: string,
  targetVersion?: string | null,
  packageUrl?: string | null
): Promise<Command> {
  const command = await createCommand(siteId, type, pluginSlug, targetVersion, packageUrl);

  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });

  if (site.siteToken) {
    await pingSite(site.url, site.siteToken);
  }

  return prisma.command.findUniqueOrThrow({ where: { id: command.id } });
}
