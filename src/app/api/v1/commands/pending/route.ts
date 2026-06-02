import { NextRequest, NextResponse } from "next/server";
import { validateLicense, ensureSite } from "@/lib/license";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const licenseKey = searchParams.get("license_key");
  const siteUrl = searchParams.get("site_url");

  if (!licenseKey || !siteUrl) {
    return NextResponse.json(
      { error: "Missing required parameters: license_key, site_url" },
      { status: 400 }
    );
  }

  const license = await validateLicense(licenseKey, siteUrl);
  if (!license) {
    return NextResponse.json(
      { error: "Invalid or inactive license" },
      { status: 403 }
    );
  }

  const site = await ensureSite(siteUrl, license.id);

  const commands = await prisma.command.findMany({
    where: {
      siteId: site.id,
      status: { in: ["pending", "delivered"] },
    },
    orderBy: { createdAt: "asc" },
  });

  // Mark as delivered
  if (commands.length > 0) {
    await prisma.command.updateMany({
      where: {
        id: { in: commands.map((c) => c.id) },
        status: "pending",
      },
      data: {
        status: "delivered",
        deliveredAt: new Date(),
      },
    });
  }

  return NextResponse.json({
    commands: commands.map((c) => ({
      id: c.id,
      type: c.type,
      plugin_slug: c.pluginSlug,
      target_version: c.targetVersion,
      package_url: c.packageUrl,
    })),
  });
}
