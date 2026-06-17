import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { SetPageHeader } from "@/components/set-page-header";
import { SiteDetailClient } from "./site-detail-client";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      plugins: {
        include: { plugin: { select: { name: true, slug: true, githubOwner: true, githubRepo: true } } },
        orderBy: { pluginName: "asc" },
      },
      commands: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      _count: { select: { licenses: true } },
    },
  });

  if (!site) notFound();

  const allServerPlugins = await prisma.plugin.findMany({
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true },
  });

  const installedSlugs = new Set(site.plugins.map((sp) => sp.pluginSlug));
  const availableToInstall = allServerPlugins.filter(
    (p) => !installedSlugs.has(p.slug)
  );

  return (
    <div className="space-y-6">
      <SetPageHeader title={site.label || site.url} />
      <div>
        <Link href="/sites" className="text-sm text-muted-foreground hover:underline">
          &larr; Back to Sites
        </Link>
        <p className="text-muted-foreground mt-1">{site.url}</p>
      </div>

      <SiteDetailClient
        site={{
          id: site.id,
          url: site.url,
          siteToken: !!site.siteToken,
          licenseCount: site._count.licenses,
        }}
        sitePlugins={site.plugins.map((sp) => ({
          id: sp.id,
          pluginSlug: sp.pluginSlug,
          pluginName: sp.plugin?.name || sp.pluginName || sp.pluginSlug,
          installedVersion: sp.installedVersion || "Unknown",
          isActive: sp.isActive,
          isLocked: sp.isLocked,
          isManaged: !!sp.pluginId,
          lastReportedAt: sp.lastReportedAt.toISOString(),
        }))}
        commands={site.commands.map((c) => ({
          id: c.id,
          type: c.type,
          pluginSlug: c.pluginSlug,
          targetVersion: c.targetVersion,
          status: c.status,
          result: c.result,
          createdAt: c.createdAt.toISOString(),
          completedAt: c.completedAt?.toISOString() ?? null,
        }))}
        availableToInstall={availableToInstall}
      />
    </div>
  );
}
