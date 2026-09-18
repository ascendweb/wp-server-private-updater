"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { usePageHeader } from "@/components/page-header";
import { formatSiteHost } from "@/lib/site-url";
import { VisitSiteLink } from "@/components/visit-site-link";
import { cn } from "@/lib/utils";
import type { FormMonitorSiteSummary } from "@/Feature/FormMonitor/types";

function formatWhen(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function FormMonitorListClient() {
  const router = useRouter();
  const [sites, setSites] = useState<FormMonitorSiteSummary[]>([]);
  const [loading, setLoading] = useState(true);

  usePageHeader(
    "Form Monitor",
    <Link
      href="/settings/form-monitor"
      aria-label="Form Monitor settings"
      className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
    >
      <Settings />
    </Link>
  );

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/v1/form-monitor/sites");
      if (res.ok) {
        setSites(await res.json());
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sites</CardTitle>
          <CardDescription>
            Form submissions vs tracking confirmations. Missing is unmatched form events from the last 7 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
          ) : sites.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No active sites yet. Sites appear here once a license is created and checked in.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Last form</TableHead>
                  <TableHead>Last tracking</TableHead>
                  <TableHead>Missing last 7 days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((site) => (
                  <TableRow
                    key={site.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/form-monitor/${site.id}`)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {formatSiteHost(site.url)}
                        <VisitSiteLink url={site.url} />
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatWhen(site.lastFormAt)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatWhen(site.lastTrackingAt)}</TableCell>
                    <TableCell>
                      <Badge variant={site.missingLast7Days > 0 ? "warn" : "subtle"}>
                        {site.missingLast7Days}
                      </Badge>
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