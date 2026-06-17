import { prisma } from "./db";
import type { CommandType, Command } from "@prisma/client";

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
 * Send a lightweight GET ping to the site to trigger it to poll for commands.
 * The ping carries no payload -- the site verifies the token and calls back
 * to fetch pending commands via POST /api/v1/commands/poll.
 */
async function pingSite(siteUrl: string, siteToken: string): Promise<boolean> {
  try {
    const pingUrl = `${siteUrl}/?wppu_ping=1&token=${encodeURIComponent(siteToken)}`;
    const response = await fetch(pingUrl, {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
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
