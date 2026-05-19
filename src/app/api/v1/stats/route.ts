import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [pluginCount, licenseCount, activeLicenseCount, recentCheckins] =
    await Promise.all([
      prisma.plugin.count(),
      prisma.license.count(),
      prisma.license.count({ where: { status: "active" } }),
      prisma.license.count({
        where: {
          lastCheckAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

  const uniqueSites = await prisma.license.groupBy({
    by: ["siteUrl"],
    where: { status: "active" },
  });

  return NextResponse.json({
    plugins: pluginCount,
    totalLicenses: licenseCount,
    activeLicenses: activeLicenseCount,
    recentCheckins,
    uniqueSites: uniqueSites.length,
  });
}
