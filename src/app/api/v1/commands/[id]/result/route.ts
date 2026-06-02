import { NextRequest, NextResponse } from "next/server";
import { validateLicense, ensureSite } from "@/lib/license";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { license_key, site_url, success, message, new_version } = body;

  if (!license_key || !site_url) {
    return NextResponse.json(
      { error: "Missing required fields: license_key, site_url" },
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

  const command = await prisma.command.findFirst({
    where: { id, siteId: site.id },
  });

  if (!command) {
    return NextResponse.json(
      { error: "Command not found" },
      { status: 404 }
    );
  }

  await prisma.command.update({
    where: { id: command.id },
    data: {
      status: success ? "completed" : "failed",
      result: JSON.stringify({ success, message, new_version }),
      completedAt: new Date(),
    },
  });

  // If the command was a successful install/update/rollback, update SitePlugin
  if (success && new_version) {
    await prisma.sitePlugin.upsert({
      where: {
        siteId_pluginSlug: {
          siteId: site.id,
          pluginSlug: command.pluginSlug,
        },
      },
      create: {
        siteId: site.id,
        pluginSlug: command.pluginSlug,
        installedVersion: new_version,
        isActive: true,
        lastReportedAt: new Date(),
      },
      update: {
        installedVersion: new_version,
        lastReportedAt: new Date(),
      },
    });
  }

  return NextResponse.json({ success: true });
}
