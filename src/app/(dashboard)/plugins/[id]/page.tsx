import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { SetPageHeader } from "@/components/set-page-header";
import { PluginDetailClient } from "./plugin-detail-client";
import { getPluginDetailData } from "@/lib/plugin-rollout";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getPluginDetailData(id);
  return { title: data?.plugin.name ?? "Plugin" };
}

export default async function PluginDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getPluginDetailData(id);
  if (!data) notFound();

  return (
    <div className="space-y-6">
      <SetPageHeader title={data.plugin.name} />
      <div>
        <Link href="/plugins" className="text-sm text-muted-foreground hover:underline">
          &larr; Back to Plugins
        </Link>
        {data.plugin.description && (
          <p className="text-muted-foreground mt-1">{data.plugin.description}</p>
        )}
      </div>

      <PluginDetailClient
        key={data.plugin.id}
        plugin={data.plugin}
        latestVersion={data.latestVersion}
        initialRollout={data.rollout}
      />
    </div>
  );
}
