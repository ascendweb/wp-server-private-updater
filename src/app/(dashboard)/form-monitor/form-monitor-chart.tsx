"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FormMonitorDayBucket } from "@/Feature/FormMonitor/types";

function formatDayLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
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
          <Tooltip itemSorter={(item) => (item.dataKey === "submissions" ? 0 : 1)} />
          <Legend itemSorter={(item) => (item.dataKey === "submissions" ? 0 : 1)} />
          <Line
            type="monotone"
            dataKey="submissions"
            name="Submissions"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="missing"
            name="Missing Tracking"
            stroke="var(--chart-2)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FormMonitorSiteChartCard({
  days,
  title = "Last 7 days",
  description = "Submissions are form events. Missing is those still without a tracking confirmation.",
}: {
  days: FormMonitorDayBucket[];
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
        <FormMonitorChart days={days} />
      </CardContent>
    </Card>
  );
}
