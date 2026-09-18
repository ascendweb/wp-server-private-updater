import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { SetPageHeader } from "@/components/set-page-header";
import { VisitSiteLink } from "@/components/visit-site-link";
import { formatSiteHost, formatSiteTitle } from "@/lib/site-url";
import { getSiteChart } from "@/Feature/FormMonitor/queries";
import { FormMonitorSiteChartCard } from "./form-monitor-chart";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteId: string }>;
}): Promise<Metadata> {
  const { siteId } = await params;
  const data = await getSiteChart(siteId);
  return { title: data ? `${formatSiteTitle(data.site.url, data.site.label)} · Form Monitor` : "Form Monitor" };
}

export default async function FormMonitorSitePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const data = await getSiteChart(siteId);
  if (!data) notFound();

  return (
    <div className="space-y-6">
      <SetPageHeader title={formatSiteTitle(data.site.url, data.site.label)} />
      <div>
        <Link href="/form-monitor" className="text-sm text-muted-foreground hover:underline">
          ← Back to Form Monitor
        </Link>
        <p className="text-muted-foreground mt-1 flex items-center gap-2">
          {formatSiteHost(data.site.url)}
          <VisitSiteLink url={data.site.url} />
        </p>
      </div>
      <FormMonitorSiteChartCard days={data.days} />
    </div>
  );
}