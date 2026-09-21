"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  FORM_MONITOR_RANGE_IDS,
  FORM_MONITOR_RANGE_LABELS,
  formMonitorRangeQuery,
  resolveFormMonitorRange,
  utcDayKey,
  type FormMonitorRangeId,
} from "@/Feature/FormMonitor/range";

function dayKeyToLocalDate(key: string): Date {
  const [year, month, day] = key.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(year, month - 1, day);
}

function localDateToDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatRangeLabel(since: Date, until: Date) {
  const from = dayKeyToLocalDate(utcDayKey(since));
  const to = dayKeyToLocalDate(utcDayKey(until));
  if (utcDayKey(since) === utcDayKey(until)) return format(from, "LLL dd, y");
  return `${format(from, "LLL dd, y")} – ${format(to, "LLL dd, y")}`;
}

export function FormMonitorRangeControl({
  range,
  since,
  until,
  includeSpam,
}: {
  range?: string | null;
  since?: string | null;
  until?: string | null;
  includeSpam: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const resolved = resolveFormMonitorRange({ range, since, until });
  const sinceKey = utcDayKey(resolved.since);
  const untilKey = utcDayKey(resolved.until);
  const committed: DateRange = {
    from: dayKeyToLocalDate(sinceKey),
    to: dayKeyToLocalDate(untilKey),
  };
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(committed);

  useEffect(() => {
    setDraft({
      from: dayKeyToLocalDate(sinceKey),
      to: dayKeyToLocalDate(untilKey),
    });
  }, [sinceKey, untilKey]);

  function visit(next: { id: FormMonitorRangeId; sinceDay?: string; untilDay?: string; includeSpam?: boolean }) {
    const rangeValue = resolveFormMonitorRange({
      range: next.id,
      since: next.sinceDay ?? sinceKey,
      until: next.untilDay ?? untilKey,
    });
    router.push(`${pathname}${formMonitorRangeQuery(rangeValue, next.includeSpam ?? includeSpam)}`);
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setDraft({ from: dayKeyToLocalDate(sinceKey), to: dayKeyToLocalDate(untilKey) });
          }
        }}
      >
        <PopoverTrigger
          render={
            <Button variant="subtle" size="sm" className="justify-start px-2.5 font-normal" />
          }
        >
          <CalendarIcon />
          {formatRangeLabel(resolved.since, resolved.until)}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <div className="flex flex-col sm:flex-row">
            <div className="flex flex-row gap-1 overflow-x-auto border-b p-2 sm:flex-col sm:border-r sm:border-b-0">
              {FORM_MONITOR_RANGE_IDS.filter((id) => id !== "custom").map((id) => (
                <Button
                  key={id}
                  variant={resolved.id === id ? "subtle" : "ghost"}
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    visit({ id });
                    setOpen(false);
                  }}
                >
                  {FORM_MONITOR_RANGE_LABELS[id]}
                </Button>
              ))}
            </div>
            <Calendar
              mode="range"
              selected={draft}
              defaultMonth={draft?.from}
              numberOfMonths={2}
              onSelect={(next) => {
                setDraft(next);
                if (!next?.from || !next.to) return;
                visit({
                  id: "custom",
                  sinceDay: localDateToDayKey(next.from),
                  untilDay: localDateToDayKey(next.to),
                });
                setOpen(false);
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        Include spam
        <Switch
          checked={includeSpam}
          onCheckedChange={(checked) => visit({ id: resolved.id, includeSpam: checked })}
        />
      </label>
    </div>
  );
}
