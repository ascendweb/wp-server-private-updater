import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { SetPageHeader } from "@/components/set-page-header";
import { PluginDetailClient } from "./plugin-detail-client";

export default async function PluginDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  if (!plugin) notFound();

  return (
    <div className="space-y-6">
      <SetPageHeader title={plugin.name} />
      <div>
        <Link href="/plugins" className="text-sm text-muted-foreground hover:underline">
          &larr; Back to Plugins
        </Link>
        {plugin.description && (
          <p className="text-muted-foreground mt-1">{plugin.description}</p>
        )}
      </div>

      <PluginDetailClient
        plugin={{
          id: plugin.id,
          slug: plugin.slug,
          name: plugin.name,
          githubOwner: plugin.githubOwner,
          githubRepo: plugin.githubRepo,
        }}
        sitePlugins={plugin.sitePlugins.map((sp) => ({
          id: sp.id,
          siteId: sp.site.id,
          siteUrl: sp.site.url,
          siteLabel: sp.site.label || sp.site.url,
          installedVersion: sp.installedVersion || "Unknown",
          availableVersion: sp.availableVersion ?? sp.installedVersion ?? null,
          autoSync: sp.autoSync,
          isActive: sp.isActive,
        }))}
      />
    </div>
  );
}
