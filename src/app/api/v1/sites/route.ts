import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sortBySiteUrl } from "@/lib/site-url";
import { SITE_STATUS_ARCHIVED, SITE_STATUS_ACTIVE } from "@/lib/site-status";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const archived = req.nextUrl.searchParams.get("archived") === "true";

  const sites = await prisma.site.findMany({
    where: { status: archived ? SITE_STATUS_ARCHIVED : SITE_STATUS_ACTIVE },
    include: {
      _count: { select: { licenses: true, plugins: true } },
      plugins: {
        where: { pluginId: { not: null } },
        include: { plugin: { select: { name: true } } },
        orderBy: { pluginName: "asc" },
      },
      licenses: {
        where: { status: "active" },
        orderBy: { lastCheckAt: { sort: "desc", nulls: "last" } },
        take: 1,
        select: { lastCheckAt: true },
      },
    },
    orderBy: archived ? { archivedAt: "desc" } : { url: "asc" },
  });

  const result = sortBySiteUrl(
    sites.map((site) => ({
      id: site.id,
      url: site.url,
      label: site.label,
      siteToken: site.siteToken,
      pluginNames: site.plugins
        .map((sp) => sp.plugin?.name || sp.pluginName || sp.pluginSlug)
        .filter(Boolean),
      licenseCount: site._count.licenses,
      pluginCount: site._count.plugins,
      lastCheckAt: site.licenses[0]?.lastCheckAt?.toISOString() ?? null,
      archivedAt: site.archivedAt?.toISOString() ?? null,
    })),
    (site) => site.url
  );

  return NextResponse.json(result);
}
