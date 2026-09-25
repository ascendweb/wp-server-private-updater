"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FormMonitorDayBucket, FormMonitorTotals } from "@/Feature/FormMonitor/types";
import { FORM_MONITOR_SERIES_LABELS, resolveFormMonitorSeries, type FormMonitorSeriesId } from "@/Feature/FormMonitor/range";
import { FormMonitorRangeControl } from "./form-monitor-range-control";

function formatDayLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

function seriesOrder(dataKey: unknown) {
  if (dataKey === "submissions") return 0;
  if (dataKey === "missing") return 1;
  if (dataKey === "spam") return 2;
  if (dataKey === "potentialSpam") return 3;
  if (dataKey === "deleted") return 4;
  return 5;
}

const SERIES_STROKE: Record<FormMonitorSeriesId, { dataKey: keyof FormMonitorDayBucket; stroke: string; dashed?: boolean }> = {
  submissions: { dataKey: "submissions", stroke: "var(--chart-1)" },
  missing: { dataKey: "missing", stroke: "var(--chart-4)" },
  spam: { dataKey: "spam", stroke: "var(--chart-2)", dashed: true },
  potentialSpam: { dataKey: "potentialSpam", stroke: "oklch(0.7 0.18 55)", dashed: true },
  deleted: { dataKey: "deleted", stroke: "var(--chart-3)", dashed: true },
  test: { dataKey: "test", stroke: "oklch(0.55 0.2 300)", dashed: true },
};

export function FormMonitorPeriodStats({
  totals,
  series,
}: {
  totals: FormMonitorTotals;
  series: FormMonitorSeriesId[];
}) {
  const percent = totals.trackedRate === null ? null : Math.round(totals.trackedRate * 100);
  const rateClass = percent === null ? "text-muted-foreground" : percent >= 100 ? "text-green-700" : percent > 80 ? "text-orange-700" : "text-red-700";
  const enabled = new Set(series);
  const items = [
    { label: "Tracking", value: percent === null ? "N/A" : `${percent}%`, className: rateClass, show: enabled.has("submissions") || enabled.has("missing") },
    { label: "Submitted", value: String(totals.submitted), className: "text-foreground", show: enabled.has("submissions") },
    { label: "Missing", value: String(totals.missing), className: "text-foreground", show: enabled.has("missing") },
    { label: "Spam", value: String(totals.spam), className: "text-foreground", show: enabled.has("spam") },
    { label: "Potential Spam", value: String(totals.potentialSpam), className: "text-foreground", show: enabled.has("potentialSpam") },
    { label: "Deleted", value: String(totals.deleted), className: "text-foreground", show: enabled.has("deleted") },
    { label: "Test", value: String(totals.test), className: "text-foreground", show: enabled.has("test") },
  ].filter((item) => item.show);

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {items.map((item) => (
        <div className="grow rounded-lg border border-border px-3 py-1" key={item.label}>
          <div className="text-xs text-muted-foreground">{item.label}</div>
          <div className={`text-lg font-semibold ${item.className}`}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function FormMonitorChart({ days, series }: { days: FormMonitorDayBucket[]; series: FormMonitorSeriesId[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const data = days.map((day) => ({
    ...day,
    label: formatDayLabel(day.date),
  }));

  if (!mounted) {
    return <div className="h-80 w-full rounded-lg bg-chart p-2" />;
  }

  return (
    <div className="h-80 w-full rounded-lg bg-chart p-2 [&_.recharts-surface]:focus:outline-none [&_.recharts-surface]:focus-visible:outline-none [&_.recharts-wrapper]:focus:outline-none [&_.recharts-wrapper]:focus-visible:outline-none">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={36} />
          <Tooltip itemSorter={(item) => seriesOrder(item.dataKey)} />
          <Legend itemSorter={(item) => seriesOrder(item.dataKey)} />
          {series.map((id) => {
            const line = SERIES_STROKE[id];
            return (
              <Line
                key={id}
                type="monotone"
                dataKey={line.dataKey}
                name={FORM_MONITOR_SERIES_LABELS[id]}
                stroke={line.stroke}
                strokeWidth={2}
                strokeDasharray={line.dashed ? "4 4" : undefined}
                strokeOpacity={line.dashed ? 0.7 : 1}
                dot={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FormMonitorSiteChartCard({
  days,
  totals,
  title = "Form Submissions",
  range,
  since,
  until,
  series,
}: {
  days: FormMonitorDayBucket[];
  totals: FormMonitorTotals;
  title?: string;
  range?: string | null;
  since?: string | null;
  until?: string | null;
  series?: string | null;
}) {
  const selected = resolveFormMonitorSeries(series);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-bold">{title}</CardTitle>
        <CardDescription>View trends in form submissions.</CardDescription>
        <CardAction>
          <FormMonitorRangeControl range={range} since={since} until={until} series={series} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <FormMonitorPeriodStats totals={totals} series={selected} />
        <FormMonitorChart days={days} series={selected} />
      </CardContent>
    </Card>
  );
}
