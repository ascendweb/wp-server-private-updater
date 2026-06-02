import { NextRequest, NextResponse } from "next/server";
import { validateLicense, ensureSite, ensureSiteToken } from "@/lib/license";
import { prisma } from "@/lib/db";

interface HeartbeatPlugin {
  slug: string;
  basename: string;
  name?: string;
  version: string;
  active: boolean;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { license_key, site_url, plugins } = body as {
    license_key: string;
    site_url: string;
    plugins: HeartbeatPlugin[];
  };

  if (!license_key || !site_url || !Array.isArray(plugins)) {
    return NextResponse.json(
      { error: "Missing required fields: license_key, site_url, plugins[]" },
      { status: 400 }
    );
  }

  const license = await validateLicense(license_key, site_url);
  if (!license) {
    return NextResponse.json(
      { error: "Invalid or inactive license" },
      { status: 403 }
    );
  }

  const site = await ensureSite(site_url, license.id);
  const siteToken = await ensureSiteToken(site.id);

  const reportedSlugs: string[] = [];

  for (const p of plugins) {
    if (!p.slug || !p.version) continue;

    reportedSlugs.push(p.slug);

    const managedPlugin = await prisma.plugin.findUnique({
      where: { slug: p.slug },
    });

    await prisma.sitePlugin.upsert({
      where: {
        siteId_pluginSlug: { siteId: site.id, pluginSlug: p.slug },
      },
      create: {
        siteId: site.id,
        pluginSlug: p.slug,
        pluginId: managedPlugin?.id ?? null,
        pluginBasename: p.basename || null,
        pluginName: p.name || null,
        installedVersion: p.version,
        isActive: p.active,
        lastReportedAt: new Date(),
      },
      update: {
        pluginId: managedPlugin?.id ?? undefined,
        pluginBasename: p.basename || undefined,
        pluginName: p.name || undefined,
        installedVersion: p.version,
        isActive: p.active,
        lastReportedAt: new Date(),
      },
    });
  }

  // Remove plugins no longer present on the site
  if (reportedSlugs.length > 0) {
    await prisma.sitePlugin.deleteMany({
      where: {
        siteId: site.id,
        pluginSlug: { notIn: reportedSlugs },
        isLocked: false,
      },
    });
  }

  return NextResponse.json({
    success: true,
    site_token: siteToken,
    plugins_tracked: reportedSlugs.length,
  });
}
