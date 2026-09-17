import type { Plugin, SitePlugin } from "@prisma/client";
import { prisma } from "./db";

type PluginAutoDefaults = Pick<Plugin, "id" | "latestVersion" | "autoSyncNewSites">;

export async function pinAutoSyncSites(pluginId: string, version: string) {
  await prisma.sitePlugin.updateMany({
    where: { pluginId, autoSync: true },
    data: { pinnedVersion: version },
  });
}

export function sitePluginCreateFields(
  plugin: PluginAutoDefaults | null | undefined,
  installedVersion: string
) {
  const autoSync = Boolean(plugin?.autoSyncNewSites);
  return {
    pluginId: plugin?.id ?? null,
    autoSync,
    pinnedVersion: autoSync ? (plugin?.latestVersion ?? installedVersion) : installedVersion,
  };
}

export async function sitePluginAutoSyncUpdate(pluginId: string, autoSync: boolean) {
  if (!autoSync) {
    return { autoSync: false };
  }

  const plugin = await prisma.plugin.findUnique({
    where: { id: pluginId },
    select: { latestVersion: true },
  });

  return plugin?.latestVersion
    ? { autoSync: true, pinnedVersion: plugin.latestVersion }
    : { autoSync: true };
}

export async function reconcileAutoSyncPin(
  sp: SitePlugin,
  latestVersion: string | null | undefined
): Promise<SitePlugin> {
  if (!sp.autoSync || !latestVersion || sp.pinnedVersion === latestVersion) {
    return sp;
  }

  return prisma.sitePlugin.update({
    where: { id: sp.id },
    data: { pinnedVersion: latestVersion },
  });
}
