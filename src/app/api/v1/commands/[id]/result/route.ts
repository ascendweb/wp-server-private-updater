import { NextRequest, NextResponse } from "next/server";
import { validateLicense, ensureSite } from "@/lib/license";
import { prisma } from "@/lib/db";

async function resolveSiteId(body: Record<string, unknown>): Promise<string | null> {
  const { site_token, license_key, site_url } = body;

  if (site_token) {
    const site = await prisma.site.findFirst({
      where: { siteToken: site_token as string },
    });
    return site?.id ?? null;
  }

  if (license_key && site_url) {
    const license = await validateLicense(license_key as string, site_url as string);
    if (!license) return null;
    const site = await ensureSite(site_url as string, license.id);
    return site.id;
  }

  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { success, message, new_version } = body;

  const siteId = await resolveSiteId(body);
  if (!siteId) {
    return NextResponse.json(
      { error: "Authentication required: provide site_token or license_key + site_url" },
      { status: 403 }
    );
  }

  const command = await prisma.command.findFirst({
    where: { id, siteId },
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

  if (success && new_version) {
    await prisma.sitePlugin.upsert({
      where: {
        siteId_pluginSlug: {
          siteId,
          pluginSlug: command.pluginSlug,
        },
      },
      create: {
        siteId,
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
