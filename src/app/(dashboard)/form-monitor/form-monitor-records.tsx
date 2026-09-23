"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDownIcon, Copy, Flag } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RelativeTime } from "@/components/relative-time";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { FormMonitorFormSummary, FormMonitorLeadRecord } from "@/Feature/FormMonitor/types";
import {
  FORM_MONITOR_SERIES_DEFAULT,
  formMonitorRangeQuery,
  type FormMonitorSeriesId,
  type ResolvedFormMonitorRange,
} from "@/Feature/FormMonitor/range";

function formLabel(record: { formTitle: string | null; formId: number | null }) {
  if (record.formTitle) return record.formTitle;
  if (record.formId) return `Form ${record.formId}`;
  return "Untitled form";
}

function statusOf(record: FormMonitorLeadRecord): { label: string; variant: "success" | "warn" | "subtle" | "test" } {
  if (record.isTest) return { label: "Test", variant: "test" };
  if (record.deletedAt) return { label: "Deleted", variant: "subtle" };
  if (record.trackingReceivedAt || record.trackingId) return { label: "Tracked", variant: "success" };
  if (record.isSpam) return { label: "Spam", variant: "subtle" };
  if (record.ignoredAt) return { label: "Fixed", variant: "subtle" };
  return { label: "Missing", variant: "warn" };
}

function isPotentialSpam(record: FormMonitorLeadRecord) {
  return Boolean(
    !record.isTest &&
      !record.deletedAt &&
      record.isSpam &&
      (record.trackingReceivedAt || record.trackingId),
  );
}

function gfAdminUrl(siteUrl: string, formId: number, entryId?: number) {
  const base = siteUrl.replace(/\/$/, "");
  const params = new URLSearchParams({
    page: "gf_entries",
    id: String(formId),
  });
  if (entryId) {
    params.set("view", "entry");
    params.set("lid", String(entryId));
  }
  return `${base}/wp-admin/admin.php?${params.toString()}`;
}

function ViewLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 opacity-0 hover:underline group-hover:opacity-100">
      {label}
    </a>
  );
}

function PotentialSpamFlag() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="inline-flex size-3.5 shrink-0 items-center justify-center text-orange-500"
            aria-label="Potentially Spam"
          >
            <Flag className="size-3.5" />
          </button>
        }
      />
      <TooltipContent>Potentially Spam</TooltipContent>
    </Tooltip>
  );
}

function CopyTrackingId({ trackingId }: { trackingId: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-6 w-6 opacity-0 group-hover:opacity-100"
      aria-label="Copy tracking ID"
      onClick={() => {
        navigator.clipboard.writeText(trackingId);
        toast.success("Tracking ID copied");
      }}
    >
      <Copy className="size-3.5" />
    </Button>
  );
}

function rateBadge(rate: number | null) {
  if (rate === null) return <Badge variant="subtle">N/A</Badge>;
  const percent = Math.round(rate * 100);
  const label = `${percent}%`;
  if (percent >= 100) return <Badge variant="success">{label}</Badge>;
  if (percent > 80) return <Badge variant="warn">{label}</Badge>;
  return <Badge variant="error">{label}</Badge>;
}

function seriesQuery(series: FormMonitorSeriesId[]) {
  const isDefault =
    series.length === FORM_MONITOR_SERIES_DEFAULT.length && FORM_MONITOR_SERIES_DEFAULT.every((id) => series.includes(id));
  if (isDefault) return "";
  return series.length === 0 ? "none" : series.join(",");
}

export function FormMonitorRecords({
  siteId,
  siteUrl,
  series,
  range,
  group,
  forms,
  records: initialRecords,
  nextCursor: initialCursor,
}: {
  siteId: string;
  siteUrl: string;
  series: FormMonitorSeriesId[];
  range: ResolvedFormMonitorRange;
  group: "none" | "form";
  forms: FormMonitorFormSummary[];
  records: FormMonitorLeadRecord[];
  nextCursor: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [records, setRecords] = useState(initialRecords);
  const [cursor, setCursor] = useState(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const grouped = group === "form";

  useEffect(() => {
    setRecords(initialRecords);
    setCursor(initialCursor);
  }, [initialRecords, initialCursor]);

  async function loadMore() {
    if (!cursor || loadingRef.current) return;
    loadingRef.current = true;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      const seriesValue = seriesQuery(series);
      if (seriesValue) params.set("series", seriesValue);
      params.set("cursor", cursor);
      const res = await fetch(`/api/v1/form-monitor/sites/${siteId}/records?${params}`);
      if (!res.ok) {
        toast.error("Failed to load more submissions");
        return;
      }
      const data = (await res.json()) as { records?: FormMonitorLeadRecord[]; nextCursor?: string | null };
      setRecords((current) => [...current, ...(data.records ?? [])]);
      setCursor(data.nextCursor ?? null);
    } catch {
      toast.error("Failed to load more submissions");
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (grouped || !cursor) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [grouped, cursor, siteId, series]);

  function setGroup(next: string) {
    router.push(`${pathname}${formMonitorRangeQuery(range, series, next === "form" ? "form" : null)}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{grouped ? "Forms" : "Recent submissions"}</CardTitle>
        <CardDescription>
          {grouped ? "Breakdown of form submissions in the selected period." : "Submissions matching the selected series."}
        </CardDescription>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="subtle" className="h-9 min-w-36 justify-between rounded-lg px-2.5 text-sm font-normal" />}>
              {grouped ? "Group: Form" : "Group: None"}
              <ChevronDownIcon className="size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom" className="min-w-44">
              <DropdownMenuRadioGroup value={group} onValueChange={setGroup}>
                <DropdownMenuRadioItem value="none">None</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="form">Form</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent>
        {grouped ? (
          forms.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No form submissions in this period.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form</TableHead>
                  <TableHead>Last Submitted</TableHead>
                  <TableHead>Last Tracked</TableHead>
                  <TableHead># Tracked</TableHead>
                  <TableHead>Matched</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forms.map((form) => (
                  <TableRow key={form.formId != null ? `id:${form.formId}` : `title:${form.formTitle ?? ""}`} className="group">
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        {formLabel(form)}
                        {form.formId ? <ViewLink href={gfAdminUrl(siteUrl, form.formId)} label="View" /> : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <RelativeTime value={form.lastFormAt} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <RelativeTime value={form.lastTrackingAt} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {form.submitted - form.missing} / {form.submitted}
                    </TableCell>
                    <TableCell>{rateBadge(form.trackedRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        ) : records.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No form submissions recorded yet.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form</TableHead>
                  <TableHead>Form ID</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead className="w-px">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => {
                  const status = statusOf(record);
                  return (
                    <TableRow key={record.id} className="group">
                      <TableCell className="font-medium">{formLabel(record)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          {record.formId ?? "—"}
                          {record.formId ? <ViewLink href={gfAdminUrl(siteUrl, record.formId)} label="View" /> : null}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          <RelativeTime value={record.formReceivedAt} />
                          {record.deletedAt ? (
                            <span className="text-destructive opacity-0 group-hover:opacity-100">Deleted</span>
                          ) : record.formId && record.entryId ? (
                            <ViewLink href={gfAdminUrl(siteUrl, record.formId, record.entryId)} label="View" />
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          <RelativeTime value={record.trackingReceivedAt} />
                          {record.trackingId ? <CopyTrackingId trackingId={record.trackingId} /> : null}
                        </span>
                      </TableCell>
                      <TableCell className="w-px">
                        <div className="flex w-full items-center gap-1">
                          <Badge variant={status.variant} className="w-auto min-w-0 flex-1">
                            {status.label}
                          </Badge>
                          <span className="inline-flex size-3.5 shrink-0 items-center justify-center">
                            {isPotentialSpam(record) ? <PotentialSpamFlag /> : null}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {cursor ? (
              <div ref={sentinelRef} className="h-8 pt-3 text-center text-sm text-muted-foreground">
                {loadingMore ? "Loading..." : null}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
