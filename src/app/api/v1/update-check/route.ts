import { NextRequest, NextResponse } from "next/server";
import { validateLicense, ensureSite, ensureSiteToken } from "@/lib/license";
import { getLatestRelease } from "@/lib/github";
import { prisma } from "@/lib/db";
import { getServerOrigin } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const slug = searchParams.get("slug");
  const version = searchParams.get("version");
  const licenseKey = searchParams.get("license_key");
  const siteUrl = searchParams.get("site_url");

  if (!slug || !version || !licenseKey || !siteUrl) {
    return NextResponse.json(
      { error: "Missing required parameters: slug, version, license_key, site_url" },
      { status: 400 }
    );
  }

  const license = await validateLicense(licenseKey, siteUrl);
  if (!license) {
    return NextResponse.json({ error: "Invalid or inactive license" }, { status: 403 });
  }

  const site = await ensureSite(siteUrl, license.id);
  const siteToken = await ensureSiteToken(site.id);

  const plugin = await prisma.plugin.findUnique({ where: { slug } });
  if (!plugin) {
    return NextResponse.json({ error: "Plugin not found", site_token: siteToken }, { status: 404 });
  }

  const spv = await prisma.sitePluginVersion.upsert({
    where: { siteId_pluginId: { siteId: site.id, pluginId: plugin.id } },
    create: { siteId: site.id, pluginId: plugin.id },
    update: {},
  });

  const serverUrl = getServerOrigin(req);

  if (spv.autoSync) {
    const release = await getLatestRelease(plugin.githubOwner, plugin.githubRepo, slug);
    if (!release) {
      return NextResponse.json({ update: false, version, site_token: siteToken });
    }

    if (!isNewerVersion(release.version, version)) {
      return NextResponse.json({ update: false, version: release.version, site_token: siteToken });
    }

    return NextResponse.json({
      slug: plugin.slug,
      new_version: release.version,
      package: `${serverUrl}/api/v1/download/${plugin.slug}/${release.version}?license_key=${licenseKey}&site_url=${encodeURIComponent(siteUrl)}`,
      sections: { changelog: release.changelog },
      site_token: siteToken,
    });
  }

  if (spv.availableVersion && isNewerVersion(spv.availableVersion, version)) {
    return NextResponse.json({
      slug: plugin.slug,
      new_version: spv.availableVersion,
      package: `${serverUrl}/api/v1/download/${plugin.slug}/${spv.availableVersion}?license_key=${licenseKey}&site_url=${encodeURIComponent(siteUrl)}`,
      sections: { changelog: "" },
      site_token: siteToken,
    });
  }

  return NextResponse.json({ update: false, version, site_token: siteToken });
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
