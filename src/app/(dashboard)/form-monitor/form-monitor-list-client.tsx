"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, MoreHorizontal, Settings } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePageHeader } from "@/components/page-header";
import { formatSiteHost } from "@/lib/site-url";
import { VisitSiteLink } from "@/components/visit-site-link";
import { RelativeTime } from "@/components/relative-time";
import { cn } from "@/lib/utils";
import { formMonitorRangeQuery, resolveFormMonitorRange, resolveFormMonitorSeries, utcDayKey } from "@/Feature/FormMonitor/range";
import type { FormMonitorDayBucket, FormMonitorSiteSummary, FormMonitorTotals, FormMonitorTrend } from "@/Feature/FormMonitor/types";
import { FormMonitorSiteChartCard } from "./form-monitor-chart";

const emptyTotals: FormMonitorTotals = { submitted: 0, missing: 0, spam: 0, deleted: 0, test: 0, trackedRate: null };

function overviewQuery(rangeId: string, sinceKey: string, untilKey: string) {
  const params = new URLSearchParams();
  if (rangeId !== "last-7") params.set("range", rangeId);
  if (rangeId === "custom") {
    params.set("since", sinceKey);
    params.set("until", untilKey);
  }
  return `/api/v1/form-monitor/sites?${params}`;
}

function rateBadge(rate: number | null) {
  if (rate === null) return <Badge variant="subtle">N/A</Badge>;
  const percent = Math.round(rate * 100);
  const label = `${percent}%`;
  if (percent >= 100) return <Badge variant="success">{label}</Badge>;
  if (percent > 80) return <Badge variant="warn">{label}</Badge>;
  return <Badge variant="error">{label}</Badge>;
}

function trendMark(trend: FormMonitorTrend) {
  if (trend.direction === "flat") return <span className="text-muted-foreground">—</span>;
  const up = trend.direction === "up";
  return (
    <span className={up ? "text-green-700" : "text-red-700"}>
      {up ? "↑" : "↓"}
      {trend.percent === null ? "" : ` ${trend.percent}%`}
    </span>
  );
}

export function FormMonitorListClient() {
  const router = useRouter();
  const search = useSearchParams();
  const range = resolveFormMonitorRange({
    range: search.get("range"),
    since: search.get("since"),
    until: search.get("until"),
  });
  const [sites, setSites] = useState<FormMonitorSiteSummary[]>([]);
  const [days, setDays] = useState<FormMonitorDayBucket[]>([]);
  const [totals, setTotals] = useState<FormMonitorTotals>(emptyTotals);
  const [busy, setBusy] = useState<string | null>(null);
  const series = resolveFormMonitorSeries(search.get("series"));
  const rangeQuery = formMonitorRangeQuery(range, series);
  const sinceKey = utcDayKey(range.since);
  const untilKey = utcDayKey(range.until);
  const rangeKey = `${range.id}:${sinceKey}:${untilKey}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== rangeKey;

  usePageHeader(
    "Form Monitor",
    <Link href="/settings/form-monitor" aria-label="Form Monitor settings" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
      <Settings />
    </Link>,
  );

  useEffect(() => {
    let cancelled = false;
    fetch(overviewQuery(range.id, sinceKey, untilKey)).then(async (res) => {
      if (cancelled) return;
      if (res.ok) {
        const data = await res.json();
        setSites(data.sites ?? []);
        setDays(data.days ?? []);
        setTotals(data.totals ?? emptyTotals);
      }
      setLoadedKey(rangeKey);
    });
    return () => {
      cancelled = true;
    };
  }, [range.id, sinceKey, untilKey, rangeKey]);

  async function markFixed(siteId: string) {
    setBusy(siteId);
    try {
      const res = await fetch(`/api/v1/form-monitor/sites/${siteId}/mark-fixed`, { method: "POST" });
      if (!res.ok) {
        toast.error("Failed to mark as fixed");
        return;
      }
      const data = (await res.json()) as { count?: number };
      const count = data.count ?? 0;
      toast.success(count > 0 ? `Marked ${count} missing ${count === 1 ? "submission" : "submissions"} as fixed` : "No missing tracking to clear");
      const refreshed = await fetch(overviewQuery(range.id, sinceKey, untilKey));
      if (refreshed.ok) {
        const overview = await refreshed.json();
        setSites(overview.sites ?? []);
        setDays(overview.days ?? []);
        setTotals(overview.totals ?? emptyTotals);
      }
    } catch {
      toast.error("Failed to mark as fixed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <FormMonitorSiteChartCard days={days} totals={totals} title="Form submissions" range={search.get("range")} since={search.get("since")} until={search.get("until")} series={search.get("series")} />
      <Card>
        <CardHeader>
          <CardTitle>Sites</CardTitle>
          <CardDescription>Breakdown of form submissions per site.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
          ) : sites.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No active sites yet. Sites appear here once a license is created and checked in.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Last Submitted</TableHead>
                  <TableHead>Last Tracked</TableHead>
                  <TableHead># Tracked</TableHead>
                  <TableHead>Matched</TableHead>
                  <TableHead>Trend</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((site) => (
                  <TableRow key={site.id} className="cursor-pointer" onClick={() => router.push(`/form-monitor/${site.id}${rangeQuery}`)}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {formatSiteHost(site.url)}
                        <VisitSiteLink url={site.url} />
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <RelativeTime value={site.lastFormAt} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <RelativeTime value={site.lastTrackingAt} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {site.submitted - site.missing} / {site.submitted}
                    </TableCell>
                    <TableCell>{rateBadge(site.trackedRate)}</TableCell>
                    <TableCell>{trendMark(site.trend)}</TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-48">
                          <DropdownMenuItem className="whitespace-nowrap" onClick={() => markFixed(site.id)} disabled={busy === site.id}>
                            <Check />
                            Mark Fixed
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
