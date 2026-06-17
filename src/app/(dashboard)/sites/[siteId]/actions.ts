"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAndDispatch } from "@/lib/commands";
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

export async function sendCommand(
  siteId: string,
  type: CommandType,
  pluginSlug: string,
  targetVersion?: string | null
) {
  await requireAuth();

  const plugin = await prisma.plugin.findUnique({ where: { slug: pluginSlug } });

  let packageUrl: string | null = null;
  if (plugin) {
    const serverUrl = getServerOriginFromEnv();
    const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
    const license = await prisma.license.findFirst({
      where: { siteId: site.id, status: "active" },
    });

    if (license) {
      const version = targetVersion || (await getLatestVersion(plugin));
      if (version) {
        packageUrl = `${serverUrl}/api/v1/download/${pluginSlug}/${version}?license_key=${encodeURIComponent(license.key)}&site_url=${encodeURIComponent(site.url)}`;
      }
    }
  }

  return createAndDispatch(siteId, type, pluginSlug, targetVersion, packageUrl);
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
