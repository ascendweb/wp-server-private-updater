import { NextRequest, NextResponse } from "next/server";
import { validateLicense, ensureSite, ensureSiteToken } from "@/lib/license";
import { getLatestRelease } from "@/lib/github";
import { prisma } from "@/lib/db";
import { getServerOrigin } from "@/lib/utils";

type BatchItem = { slug: string; version: string };

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    license_key?: string;
    site_url?: string;
    plugins?: BatchItem[];
  };

  const licenseKey = body.license_key;
  const siteUrl = body.site_url;
  const plugins = body.plugins;

  if (!licenseKey || !siteUrl || !Array.isArray(plugins)) {
    return NextResponse.json(
      { error: "Missing required fields: license_key, site_url, plugins[]" },
      { status: 400 }
    );
  }

  const normalizedItems = plugins
    .filter((p) => p && typeof p.slug === "string" && typeof p.version === "string")
    .map((p) => ({ slug: p.slug, version: p.version }));

  if (normalizedItems.length === 0) {
    return NextResponse.json({ results: {} });
  }

  const license = await validateLicense(licenseKey, siteUrl);
  if (!license) {
    return NextResponse.json({ error: "Invalid or inactive license" }, { status: 403 });
  }

  const site = await ensureSite(siteUrl, license.id);
  const siteToken = await ensureSiteToken(site.id);
  const serverUrl = getServerOrigin(req);

  const uniqueSlugs = [...new Set(normalizedItems.map((p) => p.slug))];
  const pluginsBySlug = await prisma.plugin.findMany({
    where: { slug: { in: uniqueSlugs } },
  });

  const pluginMap = new Map(pluginsBySlug.map((p) => [p.slug, p]));

  const spvList = await prisma.sitePluginVersion.findMany({
    where: {
      siteId: site.id,
      pluginId: { in: pluginsBySlug.map((p) => p.id) },
    },
  });
  const spvByPluginId = new Map(spvList.map((spv) => [spv.pluginId, spv]));

  const resultsEntries = await Promise.all(
    normalizedItems.map(async ({ slug, version }) => {
      const plugin = pluginMap.get(slug);
      if (!plugin) return [slug, { error: "Plugin not found" }] as const;

      let spv = spvByPluginId.get(plugin.id);
      if (!spv) {
        spv = await prisma.sitePluginVersion.upsert({
          where: { siteId_pluginId: { siteId: site.id, pluginId: plugin.id } },
          create: { siteId: site.id, pluginId: plugin.id },
          update: {},
        });
      }

      if (spv.autoSync) {
        const release = await getLatestRelease(plugin.githubOwner, plugin.githubRepo, slug);
        if (!release) return [slug, { error: "No releases found" }] as const;

        if (!isNewerVersion(release.version, version)) {
          return [slug, { update: false, version: release.version }] as const;
        }

        return [
          slug,
          {
            update: true,
            new_version: release.version,
            package: `${serverUrl}/api/v1/download/${plugin.slug}/${release.version}?license_key=${licenseKey}&site_url=${encodeURIComponent(siteUrl)}`,
            sections: { changelog: release.changelog },
          },
        ] as const;
      }

      if (spv.availableVersion && isNewerVersion(spv.availableVersion, version)) {
        return [
          slug,
          {
            update: true,
            new_version: spv.availableVersion,
            package: `${serverUrl}/api/v1/download/${plugin.slug}/${spv.availableVersion}?license_key=${licenseKey}&site_url=${encodeURIComponent(siteUrl)}`,
            sections: { changelog: "" },
          },
        ] as const;
      }

      return [slug, { update: false, version }] as const;
    })
  );

  return NextResponse.json({
    site_token: siteToken,
    results: Object.fromEntries(resultsEntries),
  });
}

function isNewerVersion(latest: string, current: string): boolean {
  const l = latest.split(".").map(Number);
  const c = current.split(".").map(Number);
  const len = Math.max(l.length, c.length);
  for (let i = 0; i < len; i++) {
    const a = l[i] || 0;
    const b = c[i] || 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}
