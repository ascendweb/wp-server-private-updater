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

  const license = await validateLicense(licenseKey, siteUrl, slug);
  if (!license) {
    return NextResponse.json({ error: "Invalid or inactive license" }, { status: 403 });
  }

  const site = await ensureSite(siteUrl, license.id);
  const siteToken = await ensureSiteToken(site.id);

  const plugin = await prisma.plugin.findUnique({ where: { slug } });
  if (!plugin) {
    return NextResponse.json({ error: "Plugin not found", site_token: siteToken }, { status: 404 });
  }

  // Check version lock
  const sitePlugin = await prisma.sitePlugin.findUnique({
    where: { siteId_pluginSlug: { siteId: site.id, pluginSlug: slug } },
  });

  if (sitePlugin?.isLocked) {
    return NextResponse.json({ update: false, locked: true, site_token: siteToken });
  }

  const release = await getLatestRelease(plugin.githubOwner, plugin.githubRepo, slug);
  if (!release) {
    return NextResponse.json({ error: "No releases found", site_token: siteToken }, { status: 404 });
  }

  if (!isNewerVersion(release.version, version)) {
    return NextResponse.json({ update: false, version: release.version, site_token: siteToken });
  }

  const serverUrl = getServerOrigin(req);

  return NextResponse.json({
    slug: plugin.slug,
    new_version: release.version,
    package: `${serverUrl}/api/v1/download/${plugin.slug}/${release.version}?license_key=${licenseKey}&site_url=${encodeURIComponent(siteUrl)}`,
    sections: {
      changelog: release.changelog,
    },
    site_token: siteToken,
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
