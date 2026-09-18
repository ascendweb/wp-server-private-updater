import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SetPageHeader } from "@/components/set-page-header";
import { VisitSiteLink } from "@/components/visit-site-link";
import { formatSiteHost, formatSiteTitle } from "@/lib/site-url";
import { getSiteChart } from "@/Feature/FormMonitor/queries";
import { FormMonitorSiteChartCard } from "../form-monitor-chart";
import { FormMonitorRecords } from "../form-monitor-records";

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

  const title = formatSiteTitle(data.site.url, data.site.label);

  return (
    <div className="space-y-6">
      <SetPageHeader
        title={title}
        crumbs={[
          { label: "Form Monitor", href: "/form-monitor" },
          { label: title },
        ]}
      />
      <p className="text-muted-foreground flex items-center gap-2">
        {formatSiteHost(data.site.url)}
        <VisitSiteLink url={data.site.url} />
      </p>
      <FormMonitorSiteChartCard days={data.days} />
      <FormMonitorRecords records={data.records} />
    </div>
  );
}