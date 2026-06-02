import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PluginSitesClient } from "./plugin-sites-client";

export default async function PluginSitesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const plugin = await prisma.plugin.findUnique({
    where: { id },
  });

  if (!plugin) notFound();

  const sitePlugins = await prisma.sitePlugin.findMany({
    where: { pluginSlug: plugin.slug },
    include: {
      site: { select: { id: true, url: true, label: true, siteToken: true } },
    },
    orderBy: { site: { url: "asc" } },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/plugins" className="text-sm text-muted-foreground hover:underline">
          &larr; Back to Plugins
        </Link>
        <h1 className="text-3xl font-bold mt-2">{plugin.name}</h1>
        <p className="text-muted-foreground">
          Sites with <code>{plugin.slug}</code> installed
        </p>
      </div>

      <PluginSitesClient
        pluginSlug={plugin.slug}
        sites={sitePlugins.map((sp) => ({
          siteId: sp.site.id,
          siteUrl: sp.site.url,
          siteLabel: sp.site.label || sp.site.url,
          hasToken: !!sp.site.siteToken,
          installedVersion: sp.installedVersion || "Unknown",
          isActive: sp.isActive,
          isLocked: sp.isLocked,
          lastReportedAt: sp.lastReportedAt.toISOString(),
        }))}
      />
    </div>
  );
}
