import { cache } from "react";
import type { Command, CommandStatus, CommandType } from "@prisma/client";
import { prisma } from "./db";
import { expireStaleCommands, serializeCommand } from "./commands";
import { getPluginLatestRelease } from "./plugin-release";
import { activeSiteWhere } from "./site-status";
import { sortBySiteUrl } from "./site-url";
import type { PluginDetailData, PluginRollout, PluginRolloutSite } from "./plugin-rollout-types";

export type {
  PluginDetailData,
  PluginDetailPlugin,
  PluginRollout,
  PluginRolloutSite,
  PluginRolloutCommand,
} from "./plugin-rollout-types";

export const COMMAND_INFLIGHT_STATUSES = ["pending", "delivered", "in_progress"] as const satisfies CommandStatus[];

const SITE_COMMAND_TYPES: CommandType[] = ["refresh", "purge_cache"];

type PluginWithSites = NonNullable<Awaited<ReturnType<typeof loadPluginRecord>>>;

async function loadPluginRecord(pluginId: string) {
  return prisma.plugin.findUnique({
    where: { id: pluginId },
    include: {
      sitePlugins: {
        where: { site: activeSiteWhere },
        include: {
          site: { select: { id: true, url: true, label: true } },
        },
      },
    },
  });
}

async function latestDisplayCommandsBySite(pluginSlug: string, siteIds: string[]) {
  const latestBySite = new Map<string, Command>();
  if (siteIds.length === 0) {
    return latestBySite;
  }

  const commands = await prisma.command.findMany({
    where: {
      siteId: { in: siteIds },
      OR: [{ pluginSlug }, { type: { in: SITE_COMMAND_TYPES } }],
    },
    orderBy: { createdAt: "desc" },
  });

  for (const command of commands) {
    if (!latestBySite.has(command.siteId)) {
      latestBySite.set(command.siteId, command);
    }
  }

  return latestBySite;
}

function isInflightStatus(status: CommandStatus) {
  return (COMMAND_INFLIGHT_STATUSES as readonly string[]).includes(status);
}

function toRolloutSites(
  plugin: PluginWithSites,
  latestBySite: Map<string, Command>
): PluginRolloutSite[] {
  return sortBySiteUrl(plugin.sitePlugins, (sp) => sp.site.url).map((sp) => {
    const command = latestBySite.get(sp.siteId) ?? null;
    return {
      id: sp.id,
      siteId: sp.site.id,
      siteUrl: sp.site.url,
      siteLabel: sp.site.label || sp.site.url,
      installedVersion: sp.installedVersion || "Unknown",
      pinnedVersion: sp.pinnedVersion ?? sp.installedVersion ?? null,
      autoSync: sp.autoSync,
      isActive: sp.isActive,
      latestCommand: command ? serializeCommand(command) : null,
    };
  });
}

async function buildRollout(plugin: PluginWithSites): Promise<PluginRollout> {
  await expireStaleCommands();

  const siteIds = plugin.sitePlugins.map((sp) => sp.siteId);
  const latestBySite = await latestDisplayCommandsBySite(plugin.slug, siteIds);
  const inflight = plugin.sitePlugins.some((sp) => {
    const command = latestBySite.get(sp.siteId);
    return command ? isInflightStatus(command.status) : false;
  });

  return {
    inflight,
    sites: toRolloutSites(plugin, latestBySite),
  };
}

async function getLatestVersionSafe(plugin: PluginWithSites) {
  try {
    const release = await getPluginLatestRelease(plugin);
    return release?.version ?? null;
  } catch {
    return null;
  }
}

/** Live table snapshot used by the page and the rollout poll endpoint. */
export async function getPluginRollout(pluginId: string): Promise<PluginRollout | null> {
  const plugin = await loadPluginRecord(pluginId);
  if (!plugin) return null;
  return buildRollout(plugin);
}

/** Full document payload for the plugin detail page. */
export const getPluginDetailData = cache(async (pluginId: string): Promise<PluginDetailData | null> => {
  const plugin = await loadPluginRecord(pluginId);
  if (!plugin) return null;

  const [rollout, latestVersion] = await Promise.all([
    buildRollout(plugin),
    getLatestVersionSafe(plugin),
  ]);

  return {
    plugin: {
      id: plugin.id,
      slug: plugin.slug,
      name: plugin.name,
      description: plugin.description,
      githubOwner: plugin.githubOwner,
      githubRepo: plugin.githubRepo,
    },
    latestVersion,
    rollout,
  };
});
