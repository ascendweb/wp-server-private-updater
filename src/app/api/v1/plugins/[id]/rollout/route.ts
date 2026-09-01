import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { latestCommandsBySite, serializeCommand } from "@/lib/commands";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const plugin = await prisma.plugin.findUnique({
    where: { id },
    include: {
      sitePlugins: {
        include: {
          site: { select: { id: true, url: true, label: true } },
        },
        orderBy: { site: { url: "asc" } },
      },
    },
  });

  if (!plugin) {
    return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
  }

  const latestBySite = await latestCommandsBySite(
    plugin.slug,
    plugin.sitePlugins.map((sp) => sp.siteId),
    "update"
  );

  return NextResponse.json({
    sites: plugin.sitePlugins.map((sp) => ({
      id: sp.id,
      siteId: sp.site.id,
      siteUrl: sp.site.url,
      siteLabel: sp.site.label || sp.site.url,
      installedVersion: sp.installedVersion || "Unknown",
      availableVersion: sp.availableVersion ?? sp.installedVersion ?? null,
      autoSync: sp.autoSync,
      isActive: sp.isActive,
      latestCommand: latestBySite.has(sp.siteId)
        ? serializeCommand(latestBySite.get(sp.siteId)!)
        : null,
    })),
  });
}
