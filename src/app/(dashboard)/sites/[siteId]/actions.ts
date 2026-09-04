"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAndDispatchMany, reloadSiteHostCookies } from "@/lib/commands";
import { getLatestRelease } from "@/lib/github";
import { getServerOriginFromEnv } from "@/lib/utils";
import type { CommandType } from "@prisma/client";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

export async function bumpSitePlugin(sitePluginId: string, pluginSlug: string) {
  await requireAuth();
  const plugin = await prisma.plugin.findUnique({ where: { slug: pluginSlug } });
  if (!plugin) throw new Error("Plugin not found");

  const release = await getLatestRelease(plugin.githubOwner, plugin.githubRepo, plugin.slug);
  if (!release?.version) throw new Error("No release found");

  await prisma.sitePlugin.update({
    where: { id: sitePluginId },
    data: { availableVersion: release.version },
  });
}

export async function sendCommands(
  siteId: string,
  items: Array<{ type: CommandType; pluginSlug: string; targetVersion?: string | null }>
) {
  await requireAuth();

  if (items.length === 0) {
    return [];
  }

  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
  const serverUrl = getServerOriginFromEnv();
  const license = await prisma.license.findFirst({
    where: { siteId: site.id, status: "active" },
  });

  const specs = [];
  for (const item of items) {
    const plugin = await prisma.plugin.findUnique({ where: { slug: item.pluginSlug } });
    let packageUrl: string | null = null;
    if (plugin && license) {
      const version = item.targetVersion || (await getLatestVersion(plugin));
      if (version) {
        packageUrl = `${serverUrl}/api/v1/download/${item.pluginSlug}/${version}?license_key=${encodeURIComponent(license.key)}&site_url=${encodeURIComponent(site.url)}`;
      }
    }
    specs.push({
      type: item.type,
      pluginSlug: item.pluginSlug,
      targetVersion: item.targetVersion ?? null,
      packageUrl,
    });
  }

  return createAndDispatchMany(siteId, specs);
}

export async function sendCommand(
  siteId: string,
  type: CommandType,
  pluginSlug: string,
  targetVersion?: string | null
) {
  const commands = await sendCommands(siteId, [{ type, pluginSlug, targetVersion }]);
  const command = commands[0];
  if (!command) {
    throw new Error("Failed to create command.");
  }
  return command;
}

async function getLatestVersion(plugin: { githubOwner: string; githubRepo: string; slug: string }) {
  try {
    const release = await getLatestRelease(plugin.githubOwner, plugin.githubRepo, plugin.slug);
    return release?.version ?? null;
  } catch {
    return null;
  }
}

export async function getReleaseVersions(pluginSlug: string) {
  await requireAuth();
  const plugin = await prisma.plugin.findUnique({ where: { slug: pluginSlug } });
  if (!plugin) return [];

  try {
    const release = await getLatestRelease(plugin.githubOwner, plugin.githubRepo, plugin.slug);
    return release ? [release.version] : [];
  } catch {
    return [];
  }
}

export async function deleteSite(siteId: string) {
  await requireAuth();
  await prisma.site.delete({ where: { id: siteId } });
}

export async function reloadHostCookies(siteId: string) {
  await requireAuth();
  return reloadSiteHostCookies(siteId);
}
