import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { activeSiteWhere, excludeArchivedSiteLicenses } from "@/lib/site-status";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    pluginCount,
    licenseCount,
    activeLicenseCount,
    recentCheckins,
    siteCount,
    sitesWithToken,
    pendingCommands,
  ] = await Promise.all([
    prisma.plugin.count(),
    prisma.license.count({ where: excludeArchivedSiteLicenses }),
    prisma.license.count({
      where: {
        status: "active",
        ...excludeArchivedSiteLicenses,
      },
    }),
    prisma.license.count({
      where: {
        lastCheckAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        ...excludeArchivedSiteLicenses,
      },
    }),
    prisma.site.count({ where: activeSiteWhere }),
    prisma.site.count({ where: { ...activeSiteWhere, siteToken: { not: null } } }),
    prisma.command.count({ where: { status: "pending", site: activeSiteWhere } }),
  ]);

  return NextResponse.json({
    plugins: pluginCount,
    totalLicenses: licenseCount,
    activeLicenses: activeLicenseCount,
    recentCheckins,
    sites: siteCount,
    sitesWithToken,
    pendingCommands,
  });
}
