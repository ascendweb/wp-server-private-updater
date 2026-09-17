"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAndDispatch, serializeCommand, isSiteCommand } from "@/lib/commands";
import { getPluginLatestRelease } from "@/lib/plugin-release";
import { sitePluginAutoSyncUpdate } from "@/lib/site-plugin";
import { activeSiteWhere } from "@/lib/site-status";
import type { CommandType } from "@prisma/client";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

const DISPATCH_TYPES = new Set<CommandType>(["update", "activate", "deactivate", "refresh", "purge_cache"]);

export async function dispatchPluginCommands(
  pluginId: string,
  siteIds: string[],
  type: CommandType
) {
  await requireAuth();

  if (!DISPATCH_TYPES.has(type)) {
    throw new Error("Unsupported command type");
  }
  if (siteIds.length === 0) {
    return { dispatched: 0, commands: [] };
  }

  const plugin = await prisma.plugin.findUnique({ where: { id: pluginId } });
  if (!plugin) throw new Error("Plugin not found");

  const sitePlugins = await prisma.sitePlugin.findMany({
    where: {
      pluginId: plugin.id,
      siteId: { in: siteIds },
      site: activeSiteWhere,
    },
    select: { siteId: true },
  });

  let releaseVersion: string | null = null;
  if (type === "update") {
    const release = await getPluginLatestRelease(plugin);
    if (release?.version) {
      releaseVersion = release.version;
    }
  }

  const commands = await Promise.all(
    sitePlugins.map(async (sp) => {
      const command = await createAndDispatch(
        sp.siteId,
        type,
        isSiteCommand(type) ? null : plugin.slug,
        type === "update" ? releaseVersion : null
      );
      return serializeCommand(command);
    })
  );

  return { dispatched: commands.length, commands };
}

export async function setSitesAutoSync(
  pluginId: string,
  siteIds: string[],
  autoSync: boolean
) {
  await requireAuth();

  if (siteIds.length === 0) {
    return { updated: 0 };
  }

  const result = await prisma.sitePlugin.updateMany({
    where: { pluginId, siteId: { in: siteIds }, site: activeSiteWhere },
    data: await sitePluginAutoSyncUpdate(pluginId, autoSync),
  });

  return { updated: result.count };
}
