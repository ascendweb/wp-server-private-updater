"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const SPAM_ITEMS = [
  { value: "exclude", label: "Exclude Spam" },
  { value: "include", label: "Include Spam" },
] as const;

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
  const draftRef = useRef(draft);
  const skipApplyRef = useRef(false);

  function setRangeDraft(next: DateRange | undefined) {
    draftRef.current = next;
    setDraft(next);
  }

  function visit(next: { id: FormMonitorRangeId; sinceDay?: string; untilDay?: string; includeSpam?: boolean }) {
    const rangeValue = resolveFormMonitorRange({
      range: next.id,
      since: next.sinceDay ?? sinceKey,
      until: next.untilDay ?? untilKey,
    });
    router.push(`${pathname}${formMonitorRangeQuery(rangeValue, next.includeSpam ?? includeSpam)}`);
  }

  function applyDraft() {
    const current = draftRef.current;
    if (!current?.from || !current.to) return;
    const sinceDay = localDateToDayKey(current.from);
    const untilDay = localDateToDayKey(current.to);
    if (sinceDay === sinceKey && untilDay === untilKey) return;
    visit({ id: "custom", sinceDay, untilDay });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setRangeDraft({ from: dayKeyToLocalDate(sinceKey), to: dayKeyToLocalDate(untilKey) });
            return;
          }
          if (skipApplyRef.current) {
            skipApplyRef.current = false;
            return;
          }
          applyDraft();
        }}
      >
        <PopoverTrigger
          render={
            <Button variant="subtle" className="h-9 justify-start rounded-lg px-2.5 text-sm font-normal" />
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
                    skipApplyRef.current = true;
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
                setRangeDraft(next);
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
      <Select
        items={SPAM_ITEMS}
        value={includeSpam ? "include" : "exclude"}
        onValueChange={(value) => {
          if (value !== "include" && value !== "exclude") return;
          visit({ id: resolved.id, includeSpam: value === "include" });
        }}
      >
        <SelectTrigger className="h-9 min-w-36 rounded-lg border-transparent bg-muted px-2.5 text-sm font-normal hover:bg-muted/80 data-[size=default]:h-9 dark:border-transparent dark:bg-muted/50 dark:hover:bg-muted/80">
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          side="bottom"
          align="start"
          alignItemWithTrigger={false}
          collisionAvoidance={{ side: "shift", align: "shift", fallbackAxisSide: "none" }}
        >
          {SPAM_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
