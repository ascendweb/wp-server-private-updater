"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAndDispatchMany, reloadSiteHostCookies } from "@/lib/commands";
import { getPluginLatestRelease } from "@/lib/plugin-release";
import type { CommandType } from "@prisma/client";
import { SITE_STATUS_ACTIVE, SITE_STATUS_ARCHIVED } from "@/lib/site-status";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

export async function bumpSitePlugin(sitePluginId: string, pluginSlug: string) {
  await requireAuth();
  const plugin = await prisma.plugin.findUnique({ where: { slug: pluginSlug } });
  if (!plugin) throw new Error("Plugin not found");

  const release = await getPluginLatestRelease(plugin);
  if (!release?.version) throw new Error("No release found");

  await prisma.sitePlugin.update({
    where: { id: sitePluginId },
    data: { pinnedVersion: release.version },
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

  return createAndDispatchMany(siteId, items);
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

export async function getReleaseVersions(pluginSlug: string) {
  await requireAuth();
  const plugin = await prisma.plugin.findUnique({ where: { slug: pluginSlug } });
  if (!plugin) return [];

  try {
    const release = await getPluginLatestRelease(plugin);
    return release ? [release.version] : [];
  } catch {
    return [];
  }
}

export async function archiveSite(siteId: string) {
  await requireAuth();
  await prisma.site.update({
    where: { id: siteId },
    data: { status: SITE_STATUS_ARCHIVED, archivedAt: new Date() },
  });
}

export async function restoreSite(siteId: string) {
  await requireAuth();
  await prisma.site.update({
    where: { id: siteId },
    data: { status: SITE_STATUS_ACTIVE, archivedAt: null },
  });
}

export async function reloadHostCookies(siteId: string) {
  await requireAuth();
  return reloadSiteHostCookies(siteId);
}
