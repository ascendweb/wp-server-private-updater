import { NextRequest, NextResponse } from "next/server";
import { validateLicense, ensureSite } from "@/lib/license";
import { prisma } from "@/lib/db";
import { commandPluginSlug } from "@/lib/commands";
import { sitePluginCreateFields } from "@/lib/site-plugin";
import type { Prisma } from "@prisma/client";

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
  const body = (await req.json()) as Record<string, unknown>;
  const { success, message, new_version, is_active, result, isError, output } = body;

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

  const storedResult =
    result && typeof result === "object"
      ? result
      : {
          success: Boolean(success),
          message,
          new_version,
          ...(typeof is_active === "boolean" ? { is_active } : {}),
          ...(output !== undefined ? { output } : {}),
          ...(typeof isError === "boolean" ? { isError } : {}),
        };

  const ok = success !== false && isError !== true && (storedResult as { success?: unknown }).success !== false;

  await prisma.command.update({
    where: { id: command.id },
    data: {
      status: ok ? "completed" : "failed",
      result: storedResult as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });

  const pluginSlug = commandPluginSlug(command);
  if (ok && new_version && pluginSlug) {
    const catalogPlugin = await prisma.plugin.findUnique({ where: { slug: pluginSlug } });
    await prisma.sitePlugin.upsert({
      where: {
        siteId_pluginSlug: {
          siteId,
          pluginSlug,
        },
      },
      create: {
        siteId,
        pluginSlug,
        installedVersion: String(new_version),
        isActive: typeof is_active === "boolean" ? is_active : true,
        lastReportedAt: new Date(),
        ...sitePluginCreateFields(catalogPlugin, String(new_version)),
      },
      update: {
        installedVersion: String(new_version),
        ...(typeof is_active === "boolean" ? { isActive: is_active } : {}),
        lastReportedAt: new Date(),
      },
    });
  } else if (ok && typeof is_active === "boolean" && pluginSlug) {
    await prisma.sitePlugin.updateMany({
      where: { siteId, pluginSlug },
      data: { isActive: is_active, lastReportedAt: new Date() },
    });
  }

  return NextResponse.json({ success: true });
}
