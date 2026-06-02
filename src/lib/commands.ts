import { prisma } from "./db";
import type { CommandType, Command, Site } from "@prisma/client";

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
 * Try to push a command directly to the site's WP REST API.
 * Returns true if the push succeeded, false if it failed (command stays pending for poll).
 */
export async function dispatchCommand(
  command: Command,
  site: Site
): Promise<boolean> {
  if (!site.pushUrl || !site.siteToken) return false;

  try {
    const response = await fetch(`${site.pushUrl}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${site.siteToken}`,
      },
      body: JSON.stringify({
        command_id: command.id,
        type: command.type,
        plugin_slug: command.pluginSlug,
        target_version: command.targetVersion,
        package_url: command.packageUrl,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) return false;

    const result = await response.json();

    await prisma.command.update({
      where: { id: command.id },
      data: {
        status: result.success ? "completed" : "failed",
        result: JSON.stringify(result),
        deliveredAt: new Date(),
        completedAt: new Date(),
      },
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Create a command and attempt immediate push, falling back to poll queue.
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
  await dispatchCommand(command, site);

  return prisma.command.findUniqueOrThrow({ where: { id: command.id } });
}
