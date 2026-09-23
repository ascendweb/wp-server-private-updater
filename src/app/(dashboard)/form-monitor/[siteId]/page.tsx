import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SetPageHeader } from "@/components/set-page-header";
import { VisitSiteLink } from "@/components/visit-site-link";
import { formatSiteHost, formatSiteTitle } from "@/lib/site-url";
import { getSiteChart } from "@/Feature/FormMonitor/queries";
import { formMonitorRangeQuery, resolveFormMonitorRange, resolveFormMonitorSeries } from "@/Feature/FormMonitor/range";
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
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ range?: string; since?: string; until?: string; series?: string }>;
}) {
  const { siteId } = await params;
  const query = await searchParams;
  const range = resolveFormMonitorRange(query);
  const series = resolveFormMonitorSeries(query.series);
  const data = await getSiteChart(siteId, { ...query, series: query.series });
  if (!data) notFound();

  const title = formatSiteTitle(data.site.url, data.site.label);

  return (
    <div className="space-y-6">
      <SetPageHeader
        title={title}
        crumbs={[
          { label: "Form Monitor", href: `/form-monitor${formMonitorRangeQuery(range, series)}` },
          { label: title },
        ]}
      />
      <p className="text-muted-foreground flex items-center gap-2">
        {formatSiteHost(data.site.url)}
        <VisitSiteLink url={data.site.url} />
      </p>
      <FormMonitorSiteChartCard
        days={data.days}
        totals={data.totals}
        title="Form submissions"
        range={query.range}
        since={query.since}
        until={query.until}
        series={query.series}
      />
      <FormMonitorRecords records={data.records} siteUrl={data.site.url} series={series} />
    </div>
  );
}
