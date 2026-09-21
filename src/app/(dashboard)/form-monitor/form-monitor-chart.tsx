"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FormMonitorDayBucket, FormMonitorTotals } from "@/Feature/FormMonitor/types";

function formatDayLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

function seriesOrder(dataKey: unknown) {
  if (dataKey === "submissions") return 0;
  if (dataKey === "missing") return 1;
  return 2;
}

export function FormMonitorPeriodStats({ totals }: { totals: FormMonitorTotals }) {
  const percent = totals.trackedRate === null ? null : Math.round(totals.trackedRate * 100);
  const rateClass =
    percent === null
      ? "text-muted-foreground"
      : percent >= 100
        ? "text-green-700"
        : percent > 80
          ? "text-orange-700"
          : "text-red-700";

  const items = [
    { label: "Tracking", value: percent === null ? "N/A" : `${percent}%`, className: rateClass },
    { label: "Submitted", value: String(totals.submitted), className: "text-foreground" },
    { label: "Missing", value: String(totals.missing), className: "text-foreground" },
    { label: "Spam", value: String(totals.spam), className: "text-foreground" },
  ];

  return (
    <div className="mb-4 flex flex-wrap gap-6">
      {items.map((item) => (
        <div key={item.label}>
          <div className="text-xs text-muted-foreground">{item.label}</div>
          <div className={`text-lg font-semibold ${item.className}`}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function FormMonitorChart({ days }: { days: FormMonitorDayBucket[] }) {
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
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={36} />
          <Tooltip itemSorter={(item) => seriesOrder(item.dataKey)} />
          <Legend itemSorter={(item) => seriesOrder(item.dataKey)} />
          <Line type="monotone" dataKey="submissions" name="Submissions" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="missing" name="Missing Tracking" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
          <Line
            type="monotone"
            dataKey="spam"
            name="Spam"
            stroke="var(--chart-3)"
            strokeWidth={2}
            strokeDasharray="4 4"
            strokeOpacity={0.45}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FormMonitorSiteChartCard({
  days,
  totals,
  title = "Form submissions",
  description = "Submitted and missing exclude spam. Spam is shown on its own.",
}: {
  days: FormMonitorDayBucket[];
  totals: FormMonitorTotals;
  title?: string;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <FormMonitorPeriodStats totals={totals} />
        <FormMonitorChart days={days} />
      </CardContent>
    </Card>
  );
}
