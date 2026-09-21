"use client";

import { useRouter, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FORM_MONITOR_RANGE_IDS,
  FORM_MONITOR_RANGE_LABELS,
  formMonitorRangeQuery,
  resolveFormMonitorRange,
  utcDayKey,
  type FormMonitorRangeId,
} from "@/Feature/FormMonitor/range";

export function FormMonitorRangeControl({
  range,
  since,
  until,
}: {
  range?: string | null;
  since?: string | null;
  until?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const resolved = resolveFormMonitorRange({ range, since, until });

  function visit(next: { id: FormMonitorRangeId; sinceDay?: string; untilDay?: string }) {
    const rangeValue = resolveFormMonitorRange({
      range: next.id,
      since: next.sinceDay ?? utcDayKey(resolved.since),
      until: next.untilDay ?? utcDayKey(resolved.until),
    });
    router.push(`${pathname}${formMonitorRangeQuery(rangeValue)}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={resolved.id}
        onValueChange={(value) => {
          if (!value) return;
          visit({ id: value as FormMonitorRangeId });
        }}
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FORM_MONITOR_RANGE_IDS.map((id) => (
            <SelectItem key={id} value={id}>
              {FORM_MONITOR_RANGE_LABELS[id]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {resolved.id === "custom" ? (
        <>
          <Input
            type="date"
            value={utcDayKey(resolved.since)}
            onChange={(event) => visit({ id: "custom", sinceDay: event.target.value, untilDay: utcDayKey(resolved.until) })}
            className="w-40"
          />
          <Input
            type="date"
            value={utcDayKey(resolved.until)}
            onChange={(event) => visit({ id: "custom", sinceDay: utcDayKey(resolved.since), untilDay: event.target.value })}
            className="w-40"
          />
        </>
      ) : null}
    </div>
  );
}
