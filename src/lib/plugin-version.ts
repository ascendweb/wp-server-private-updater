import semver from "semver";

export function stripVersionPrefix(version: string): string {
  return version.trim().replace(/^v/i, "");
}

export function parsePluginVersion(input: string | null | undefined) {
  if (!input) return null;
  const cleaned = stripVersionPrefix(input);
  if (!cleaned) return null;
  return (
    semver.parse(cleaned, { loose: true }) ??
    semver.coerce(cleaned, { loose: true, includePrerelease: true })
  );
}

export function isNewerVersion(latest: string | null | undefined, current: string | null | undefined): boolean {
  const a = parsePluginVersion(latest);
  const b = parsePluginVersion(current);
  if (!a || !b) return false;
  return semver.gt(a, b);
}

export type PluginSiteStats = {
  sites: number;
  needsUpdate: number;
  outdated: number;
};

export function countPluginSites(
  latestVersion: string | null | undefined,
  sitePlugins: { installedVersion: string | null; pinnedVersion: string | null }[]
): PluginSiteStats {
  let needsUpdate = 0;
  let outdated = 0;

  for (const sp of sitePlugins) {
    if (sp.pinnedVersion && sp.installedVersion && isNewerVersion(sp.pinnedVersion, sp.installedVersion)) {
      needsUpdate++;
    }

    const pin = sp.pinnedVersion || sp.installedVersion;
    if (pin && latestVersion && isNewerVersion(latestVersion, pin)) {
      outdated++;
    }
  }

  return { sites: sitePlugins.length, needsUpdate, outdated };
}
