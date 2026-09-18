"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import type { FormMonitorDayBucket, FormMonitorSiteSummary } from "@/Feature/FormMonitor/types";
import { FormMonitorSiteChartCard } from "./form-monitor-chart";

export function FormMonitorListClient() {
  const router = useRouter();
  const [sites, setSites] = useState<FormMonitorSiteSummary[]>([]);
  const [days, setDays] = useState<FormMonitorDayBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  usePageHeader(
    "Form Monitor",
    <Link href="/settings/form-monitor" aria-label="Form Monitor settings" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
      <Settings />
    </Link>,
  );

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/form-monitor/sites");
    if (res.ok) {
      const data = await res.json();
      setSites(data.sites ?? []);
      setDays(data.days ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      await load();
    } catch {
      toast.error("Failed to mark as fixed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <FormMonitorSiteChartCard days={days} title="Form Submissions" description="All form submissions from the last 7 days." />
      <Card>
        <CardHeader>
          <CardTitle>Sites</CardTitle>
          <CardDescription>Form submissions vs tracking confirmations. Missing is unmatched form events from the last 7 days.</CardDescription>
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
                  <TableHead>Last Form</TableHead>
                  <TableHead>Last Tracking</TableHead>
                  <TableHead>Missing Last 7 Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((site) => (
                  <TableRow key={site.id} className="cursor-pointer" onClick={() => router.push(`/form-monitor/${site.id}`)}>
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
                    <TableCell>
                      <Badge variant="subtle">{site.missingLast7Days}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={site.status === "pass" ? "success" : "error"}>{site.status === "pass" ? "Passing" : "Failing"}</Badge>
                    </TableCell>
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
