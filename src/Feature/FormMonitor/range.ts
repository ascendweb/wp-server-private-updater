const DAY_MS = 24 * 60 * 60 * 1000;

export const FORM_MONITOR_RANGE_IDS = [
  "today",
  "yesterday",
  "last-7",
  "last-30",
  "this-month",
  "last-month",
  "custom",
] as const;

export type FormMonitorRangeId = (typeof FORM_MONITOR_RANGE_IDS)[number];

export const FORM_MONITOR_RANGE_LABELS: Record<FormMonitorRangeId, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "last-7": "Last 7 days",
  "last-30": "Last 30 days",
  "this-month": "This month",
  "last-month": "Last month",
  custom: "Custom",
};

export type ResolvedFormMonitorRange = {
  id: FormMonitorRangeId;
  since: Date;
  until: Date;
};

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(date: Date): Date {
  return new Date(startOfUtcDay(date).getTime() + DAY_MS - 1);
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(startOfUtcDay(date).getTime() + days * DAY_MS);
}

function isRangeId(value: string | null | undefined): value is FormMonitorRangeId {
  return FORM_MONITOR_RANGE_IDS.includes(value as FormMonitorRangeId);
}

function parseDay(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

export function utcDayKey(date: Date): string {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

export function resolveFormMonitorRange(input?: {
  range?: string | null;
  since?: string | null;
  until?: string | null;
  now?: Date;
}): ResolvedFormMonitorRange {
  const now = input?.now ?? new Date();
  const id = isRangeId(input?.range) ? input.range : "last-7";
  const today = startOfUtcDay(now);

  if (id === "custom") {
    const sinceDay = parseDay(input?.since) ?? addUtcDays(today, -6);
    const untilDay = parseDay(input?.until) ?? today;
    const since = startOfUtcDay(sinceDay);
    const until = endOfUtcDay(untilDay);
    if (since.getTime() <= until.getTime()) {
      return { id, since, until };
    }
    return { id, since: startOfUtcDay(untilDay), until: endOfUtcDay(sinceDay) };
  }

  if (id === "today") {
    return { id, since: today, until: endOfUtcDay(today) };
  }

  if (id === "yesterday") {
    const day = addUtcDays(today, -1);
    return { id, since: day, until: endOfUtcDay(day) };
  }

  if (id === "last-30") {
    return { id, since: addUtcDays(today, -29), until: endOfUtcDay(today) };
  }

  if (id === "this-month") {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return { id, since: start, until: endOfUtcDay(today) };
  }

  if (id === "last-month") {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
    return { id, since: start, until: endOfUtcDay(end) };
  }

  return { id: "last-7", since: addUtcDays(today, -6), until: endOfUtcDay(today) };
}

export const FORM_MONITOR_SERIES_IDS = ["submissions", "missing", "spam", "potentialSpam", "deleted", "test"] as const;

export type FormMonitorSeriesId = (typeof FORM_MONITOR_SERIES_IDS)[number];

export const FORM_MONITOR_SERIES_LABELS: Record<FormMonitorSeriesId, string> = {
  submissions: "Submissions",
  missing: "Missing Tracking",
  spam: "Spam",
  potentialSpam: "Potential Spam",
  deleted: "Deleted",
  test: "Test",
};

export const FORM_MONITOR_SERIES_DEFAULT: FormMonitorSeriesId[] = ["submissions", "missing"];

function isSeriesId(value: string): value is FormMonitorSeriesId {
  return FORM_MONITOR_SERIES_IDS.includes(value as FormMonitorSeriesId);
}

export function resolveFormMonitorSeries(value?: string | null): FormMonitorSeriesId[] {
  if (value === "none") return [];
  if (!value) return [...FORM_MONITOR_SERIES_DEFAULT];
  const seen = new Set<FormMonitorSeriesId>();
  for (const part of value.split(",")) {
    const id = part.trim();
    if (isSeriesId(id)) seen.add(id);
  }
  return seen.size === 0 && value.trim() !== "none" ? [...FORM_MONITOR_SERIES_DEFAULT] : [...seen];
}

function seriesIsDefault(series: FormMonitorSeriesId[]): boolean {
  return series.length === FORM_MONITOR_SERIES_DEFAULT.length && FORM_MONITOR_SERIES_DEFAULT.every((id) => series.includes(id));
}

export function formMonitorRangeQuery(
  range: ResolvedFormMonitorRange,
  series: FormMonitorSeriesId[] = FORM_MONITOR_SERIES_DEFAULT,
  group?: string | null,
): string {
  const params = new URLSearchParams();
  if (range.id !== "last-7") params.set("range", range.id);
  if (range.id === "custom") {
    params.set("since", utcDayKey(range.since));
    params.set("until", utcDayKey(range.until));
  }
  if (!seriesIsDefault(series)) {
    params.set("series", series.length === 0 ? "none" : series.join(","));
  }
  if (group === "form") params.set("group", "form");
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function resolveFormMonitorGroup(value?: string | null): "none" | "form" {
  return value === "form" ? "form" : "none";
}
