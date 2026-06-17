import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLatestRelease } from "@/lib/github";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const plugin = await prisma.plugin.findUnique({ where: { id } });
  if (!plugin) {
    return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
  }

  const body = await req.json();
  const { siteIds, version } = body as { siteIds?: string[]; version?: string };

  let syncVersion = version;
  if (!syncVersion) {
    const release = await getLatestRelease(plugin.githubOwner, plugin.githubRepo, plugin.slug);
    if (!release) {
      return NextResponse.json({ error: "No release found on GitHub" }, { status: 404 });
    }
    syncVersion = release.version;
  }

  if (siteIds && siteIds.length > 0) {
    await Promise.all(
      siteIds.map((siteId) =>
        prisma.sitePluginVersion.upsert({
          where: { siteId_pluginId: { siteId, pluginId: plugin.id } },
          create: { siteId, pluginId: plugin.id, availableVersion: syncVersion },
          update: { availableVersion: syncVersion },
        })
      )
    );
  } else {
    const allSpv = await prisma.sitePluginVersion.findMany({
      where: { pluginId: plugin.id, autoSync: false },
    });
    await Promise.all(
      allSpv.map((spv) =>
        prisma.sitePluginVersion.update({
          where: { id: spv.id },
          data: { availableVersion: syncVersion },
        })
      )
    );
  }

  return NextResponse.json({ success: true, version: syncVersion });
}
