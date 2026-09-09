import { prisma } from "@/lib/db";
import { PluginsClient } from "./plugins-client";
import { activeSiteWhere } from "@/lib/site-status";
import { countPluginSites } from "@/lib/plugin-version";
import { syncPluginLatestRelease } from "@/lib/plugin-release";
import { isGitHubAppConfigured } from "@/lib/github";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Plugins" };

export default async function PluginsPage() {
  let plugins = await prisma.plugin.findMany({
    orderBy: { createdAt: "desc" },
  });

  const missingLatest = plugins.filter((plugin) => !plugin.latestVersion);
  if (missingLatest.length > 0 && isGitHubAppConfigured()) {
    await Promise.all(
      missingLatest.map((plugin) => syncPluginLatestRelease(plugin).catch(() => null))
    );
    plugins = await prisma.plugin.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  const sitePlugins = await prisma.sitePlugin.findMany({
    where: { pluginId: { not: null }, site: activeSiteWhere },
    select: { pluginId: true, installedVersion: true, pinnedVersion: true },
  });

  const byPluginId = new Map<string, { installedVersion: string | null; pinnedVersion: string | null }[]>();
  for (const sp of sitePlugins) {
    if (!sp.pluginId) continue;
    const rows = byPluginId.get(sp.pluginId) ?? [];
    rows.push({ installedVersion: sp.installedVersion, pinnedVersion: sp.pinnedVersion });
    byPluginId.set(sp.pluginId, rows);
  }

  const initialPlugins = plugins.map((plugin) => {
    const stats = countPluginSites(plugin.latestVersion, byPluginId.get(plugin.id) ?? []);
    return {
      id: plugin.id,
      slug: plugin.slug,
      name: plugin.name,
      description: plugin.description,
      githubOwner: plugin.githubOwner,
      githubRepo: plugin.githubRepo,
      releaseAssetPattern: plugin.releaseAssetPattern,
      createdAt: plugin.createdAt,
      latestVersion: plugin.latestVersion,
      sites: stats.sites,
      needsUpdate: stats.needsUpdate,
      outdated: stats.outdated,
    };
  });

  return <PluginsClient initialPlugins={initialPlugins} />;
}
