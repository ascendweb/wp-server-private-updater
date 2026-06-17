import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sites = await prisma.site.findMany({
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
    orderBy: { updatedAt: "desc" },
  });

  const result = sites.map((site) => ({
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
  }));

  return NextResponse.json(result);
}
