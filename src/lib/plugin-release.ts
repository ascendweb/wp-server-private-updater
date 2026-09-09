import type { Plugin } from "@prisma/client";
import { prisma } from "./db";
import { fetchLatestReleaseFromGitHub, isGitHubAppConfigured, type GitHubRelease } from "./github";
import { isNewerVersion, stripVersionPrefix } from "./plugin-version";

export type StoredRelease = GitHubRelease;

export function storedReleaseFromPlugin(plugin: Plugin): StoredRelease | null {
  if (!plugin.latestVersion) return null;
  return {
    version: plugin.latestVersion,
    changelog: plugin.latestChangelog ?? "",
    publishedAt: plugin.latestPublishedAt?.toISOString() ?? null,
  };
}

export async function savePluginLatestRelease(pluginId: string, release: StoredRelease | null) {
  await prisma.plugin.update({
    where: { id: pluginId },
    data: {
      latestVersion: release?.version ?? null,
      latestChangelog: release?.changelog ?? null,
      latestPublishedAt: release?.publishedAt ? new Date(release.publishedAt) : null,
      latestSyncedAt: new Date(),
    },
  });
}

export async function syncPluginLatestRelease(plugin: Plugin): Promise<StoredRelease | null> {
  const release = await fetchLatestReleaseFromGitHub(plugin.githubOwner, plugin.githubRepo);
  await savePluginLatestRelease(plugin.id, release);
  return release;
}

export async function getPluginLatestRelease(
  plugin: Plugin,
  options?: { refresh?: boolean }
): Promise<StoredRelease | null> {
  if (options?.refresh) {
    return syncPluginLatestRelease(plugin);
  }
  if (plugin.latestVersion) {
    return storedReleaseFromPlugin(plugin);
  }
  if (!isGitHubAppConfigured()) {
    return null;
  }
  try {
    return await syncPluginLatestRelease(plugin);
  } catch {
    return null;
  }
}

export async function applyIncomingGitHubRelease(
  plugin: Plugin,
  input: {
    tagName: string;
    changelog: string;
    publishedAt: string | null;
    prerelease: boolean;
    draft: boolean;
  }
): Promise<StoredRelease | null> {
  if (input.draft || input.prerelease) {
    return storedReleaseFromPlugin(plugin);
  }

  const incoming: StoredRelease = {
    version: stripVersionPrefix(input.tagName),
    changelog: input.changelog,
    publishedAt: input.publishedAt,
  };

  if (plugin.latestVersion && isNewerVersion(plugin.latestVersion, incoming.version)) {
    return storedReleaseFromPlugin(plugin);
  }

  await savePluginLatestRelease(plugin.id, incoming);
  return incoming;
}
