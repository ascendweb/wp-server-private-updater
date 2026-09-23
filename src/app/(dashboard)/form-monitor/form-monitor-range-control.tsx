"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FORM_MONITOR_RANGE_IDS,
  FORM_MONITOR_RANGE_LABELS,
  FORM_MONITOR_SERIES_IDS,
  FORM_MONITOR_SERIES_LABELS,
  formMonitorRangeQuery,
  resolveFormMonitorRange,
  resolveFormMonitorSeries,
  utcDayKey,
  type FormMonitorRangeId,
  type FormMonitorSeriesId,
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

function formatRangeLabel(range: { id: FormMonitorRangeId; since: Date; until: Date }) {
  if (range.id !== "custom") return FORM_MONITOR_RANGE_LABELS[range.id];
  const from = dayKeyToLocalDate(utcDayKey(range.since));
  const to = dayKeyToLocalDate(utcDayKey(range.until));
  if (utcDayKey(range.since) === utcDayKey(range.until)) return format(from, "LLL dd, y");
  return `${format(from, "LLL dd, y")} – ${format(to, "LLL dd, y")}`;
}

function seriesLabel(series: FormMonitorSeriesId[]) {
  if (series.length === 0) return "No Series";
  if (series.length === 1) return FORM_MONITOR_SERIES_LABELS[series[0]];
  if (series.length === FORM_MONITOR_SERIES_IDS.length) return "All Series";
  return `${series.length} Series`;
}

const triggerClass = "h-9 rounded-lg px-2.5 text-sm font-normal";

export function FormMonitorRangeControl({
  range,
  since,
  until,
  series,
}: {
  range?: string | null;
  since?: string | null;
  until?: string | null;
  series?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const resolved = resolveFormMonitorRange({ range, since, until });
  const selectedSeries = resolveFormMonitorSeries(series);
  const sinceKey = utcDayKey(resolved.since);
  const untilKey = utcDayKey(resolved.until);
  const committed: DateRange = {
    from: dayKeyToLocalDate(sinceKey),
    to: dayKeyToLocalDate(untilKey),
  };
  const [open, setOpen] = useState(false);
  const [seriesOpen, setSeriesOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(committed);
  const draftRef = useRef(draft);
  const skipApplyRef = useRef(false);

  function setRangeDraft(next: DateRange | undefined) {
    draftRef.current = next;
    setDraft(next);
  }

  function visit(next: { id: FormMonitorRangeId; sinceDay?: string; untilDay?: string; series?: FormMonitorSeriesId[] }) {
    const rangeValue = resolveFormMonitorRange({
      range: next.id,
      since: next.sinceDay ?? sinceKey,
      until: next.untilDay ?? untilKey,
    });
    router.push(`${pathname}${formMonitorRangeQuery(rangeValue, next.series ?? selectedSeries)}`);
  }

  function applyDraft() {
    const current = draftRef.current;
    if (!current?.from || !current.to) return;
    const sinceDay = localDateToDayKey(current.from);
    const untilDay = localDateToDayKey(current.to);
    if (sinceDay === sinceKey && untilDay === untilKey) return;
    visit({ id: "custom", sinceDay, untilDay });
  }

  function toggleSeries(id: FormMonitorSeriesId, checked: boolean) {
    const next = checked ? [...selectedSeries, id] : selectedSeries.filter((item) => item !== id);
    visit({ id: resolved.id, series: FORM_MONITOR_SERIES_IDS.filter((item) => next.includes(item)) });
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
        <PopoverTrigger render={<Button variant="subtle" className={`${triggerClass} justify-start`} />}>
          <CalendarIcon />
          {formatRangeLabel(resolved)}
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
      <DropdownMenu open={seriesOpen} onOpenChange={setSeriesOpen}>
        <DropdownMenuTrigger render={<Button variant="subtle" className={`${triggerClass} min-w-36 justify-between`} />}>
          {seriesLabel(selectedSeries)}
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom" className="min-w-48">
          {FORM_MONITOR_SERIES_IDS.map((id) => (
            <DropdownMenuCheckboxItem
              key={id}
              checked={selectedSeries.includes(id)}
              closeOnClick={false}
              onCheckedChange={(checked) => toggleSeries(id, checked === true)}
            >
              {FORM_MONITOR_SERIES_LABELS[id]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
