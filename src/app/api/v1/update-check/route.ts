import { NextRequest, NextResponse } from "next/server";
import { validateLicense, ensureSite, ensureSiteToken } from "@/lib/license";
import { getPluginLatestRelease } from "@/lib/plugin-release";
import { isNewerVersion } from "@/lib/plugin-version";
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

  const sp = await prisma.sitePlugin.upsert({
    where: { siteId_pluginSlug: { siteId: site.id, pluginSlug: slug } },
    create: {
      siteId: site.id,
      pluginSlug: slug,
      pluginId: plugin.id,
      installedVersion: version,
      pinnedVersion: version,
      isActive: true,
      lastReportedAt: new Date(),
    },
    update: {
      installedVersion: version,
      lastReportedAt: new Date(),
    },
  });

  const serverUrl = getServerOrigin(req);

  if (sp.autoSync) {
    const release = await getPluginLatestRelease(plugin);
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

  if (sp.pinnedVersion && isNewerVersion(sp.pinnedVersion, version)) {
    return NextResponse.json({
      slug: plugin.slug,
      new_version: sp.pinnedVersion,
      package: `${serverUrl}/api/v1/download/${plugin.slug}/${sp.pinnedVersion}?license_key=${licenseKey}&site_url=${encodeURIComponent(siteUrl)}`,
      sections: { changelog: "" },
      site_token: siteToken,
    });
  }

  return NextResponse.json({ update: false, version, site_token: siteToken });
}
