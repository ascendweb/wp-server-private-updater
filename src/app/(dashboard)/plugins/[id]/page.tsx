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
      sitePluginVersions: {
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
        siteVersions={plugin.sitePluginVersions.map((spv) => ({
          id: spv.id,
          siteId: spv.site.id,
          siteUrl: spv.site.url,
          siteLabel: spv.site.label || spv.site.url,
          availableVersion: spv.availableVersion,
          autoSync: spv.autoSync,
          updatedAt: spv.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
