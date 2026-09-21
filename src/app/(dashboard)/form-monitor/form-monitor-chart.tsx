"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FormMonitorDayBucket, FormMonitorTotals } from "@/Feature/FormMonitor/types";
import { FormMonitorRangeControl } from "./form-monitor-range-control";

function formatDayLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

function seriesOrder(dataKey: unknown) {
  if (dataKey === "submissions") return 0;
  if (dataKey === "missing") return 1;
  return 2;
}

export function FormMonitorPeriodStats({ totals, includeSpam }: { totals: FormMonitorTotals; includeSpam: boolean }) {
  const percent = totals.trackedRate === null ? null : Math.round(totals.trackedRate * 100);
  const rateClass = percent === null ? "text-muted-foreground" : percent >= 100 ? "text-green-700" : percent > 80 ? "text-orange-700" : "text-red-700";

  const items = [{ label: "Tracking", value: percent === null ? "N/A" : `${percent}%`, className: rateClass }, { label: "Submitted", value: String(totals.submitted), className: "text-foreground" }, { label: "Missing", value: String(totals.missing), className: "text-foreground" }, ...(includeSpam ? [{ label: "Spam", value: String(totals.spam), className: "text-foreground" }] : [])];

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {items.map((item) => (
        <div className="grow py-1 px-3 rounded-lg border border-border" key={item.label}>
          <div className="text-xs text-muted-foreground">{item.label}</div>
          <div className={`text-lg font-semibold ${item.className}`}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function FormMonitorChart({ days, includeSpam }: { days: FormMonitorDayBucket[]; includeSpam: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const data = days.map((day) => ({
    ...day,
    label: formatDayLabel(day.date),
  }));

  if (!mounted) {
    return <div className="h-80 w-full" />;
  }

  return (
    <div className="h-80 w-full [&_.recharts-surface]:focus:outline-none [&_.recharts-surface]:focus-visible:outline-none [&_.recharts-wrapper]:focus:outline-none [&_.recharts-wrapper]:focus-visible:outline-none">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={36} />
          <Tooltip itemSorter={(item) => seriesOrder(item.dataKey)} />
          <Legend itemSorter={(item) => seriesOrder(item.dataKey)} />
          <Line type="monotone" dataKey="submissions" name="Submissions" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="missing" name="Missing Tracking" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
          {includeSpam ? <Line type="monotone" dataKey="spam" name="Spam" stroke="var(--chart-4)" strokeWidth={2} strokeDasharray="4 4" strokeOpacity={0.7} dot={false} /> : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FormMonitorSiteChartCard({ days, totals, title = "Form Submissions", range, since, until, includeSpam }: { days: FormMonitorDayBucket[]; totals: FormMonitorTotals; title?: string; range?: string | null; since?: string | null; until?: string | null; includeSpam: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-bold">{title}</CardTitle>
        <CardDescription>View trends in form submissions.</CardDescription>
        <CardAction>
          <FormMonitorRangeControl range={range} since={since} until={until} includeSpam={includeSpam} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <FormMonitorPeriodStats totals={totals} includeSpam={includeSpam} />
        <FormMonitorChart days={days} includeSpam={includeSpam} />
      </CardContent>
    </Card>
  );
}
