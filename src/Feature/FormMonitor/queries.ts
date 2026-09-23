import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { activeSiteWhere } from "@/lib/site-status";
import { sortBySiteUrl } from "@/lib/site-url";
import type {
  FormMonitorDayBucket,
  FormMonitorFormSummary,
  FormMonitorLeadRecord,
  FormMonitorSiteSummary,
  FormMonitorTotals,
  FormMonitorTrend,
} from "./types";
import { FORM_MONITOR_EVENT_LIMIT } from "./protocol";
import {
  resolveFormMonitorRange,
  resolveFormMonitorSeries,
  utcDayKey,
  type FormMonitorSeriesId,
  type ResolvedFormMonitorRange,
} from "./range";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export type FormMonitorRange = {
  since: Date;
  until: Date;
};

export type FormMonitorSiteRangeSummary = {
  id: string;
  url: string;
  label: string | null;
  lastFormAt: string | null;
  lastTrackingAt: string | null;
  missingCount: number;
  status: "pass" | "fail";
};

export type FormMonitorEventRecord = FormMonitorLeadRecord & {
  siteId: string | null;
  siteUrl: string | null;
  siteLabel: string | null;
  status: "tracked" | "missing" | "fixed" | "spam" | "test" | "deleted";
};

function parseIsoDate(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${field} date`);
  }
  return date;
}

export function formMonitorRange(since?: string, until?: string): FormMonitorRange {
  const parsedUntil = until ? parseIsoDate(until, "until") : new Date();
  const parsedSince = since ? parseIsoDate(since, "since") : new Date(parsedUntil.getTime() - WEEK_MS);
  if (parsedSince.getTime() > parsedUntil.getTime()) {
    throw new Error("since must be before until");
  }
  return { since: parsedSince, until: parsedUntil };
}

function countedLeadWhere(): Prisma.FormMonitorLeadWhereInput {
  return {
    isTest: false,
    deletedAt: null,
    OR: [{ isSpam: false }, { trackingReceivedAt: { not: null } }, { trackingId: { not: null } }],
  };
}

function hasTracking(lead: { trackingReceivedAt: Date | string | null; trackingId?: string | null }) {
  return Boolean(lead.trackingReceivedAt || lead.trackingId);
}

function isCountedLead(lead: {
  isTest: boolean;
  deletedAt: Date | string | null;
  isSpam: boolean;
  trackingReceivedAt: Date | string | null;
  trackingId?: string | null;
}) {
  if (lead.isTest || lead.deletedAt) return false;
  if (lead.isSpam && !hasTracking(lead)) return false;
  return true;
}

function leadStatus(record: {
  trackingReceivedAt: Date | string | null;
  trackingId?: string | null;
  ignoredAt: Date | string | null;
  deletedAt?: Date | string | null;
  isSpam: boolean;
  isTest?: boolean;
}): "tracked" | "missing" | "fixed" | "spam" | "test" | "deleted" {
  // Test > Tracked > Spam. Deleted stays below Test so Checkview deletes remain Test.
  if (record.isTest) return "test";
  if (record.deletedAt) return "deleted";
  if (hasTracking(record)) return "tracked";
  if (record.isSpam) return "spam";
  if (record.ignoredAt) return "fixed";
  return "missing";
}

export async function listSiteSummariesInRange(input: {
  siteIds?: string[];
  since: Date;
  until: Date;
}): Promise<FormMonitorSiteRangeSummary[]> {
  const sites = await prisma.site.findMany({
    where: input.siteIds?.length
      ? { id: { in: input.siteIds } }
      : activeSiteWhere,
    select: { id: true, url: true, label: true },
  });

  if (sites.length === 0) return [];

  const siteIds = sites.map((site) => site.id);
  const inWindow = { gte: input.since, lte: input.until };

  const [lastForm, lastTracking, missing, openMissing] = await Promise.all([
    prisma.formMonitorLead.groupBy({
      by: ["siteId"],
      where: { siteId: { in: siteIds }, formReceivedAt: { not: null }, ...countedLeadWhere() },
      _max: { formReceivedAt: true },
    }),
    prisma.formMonitorLead.groupBy({
      by: ["siteId"],
      where: { siteId: { in: siteIds }, trackingReceivedAt: { not: null }, ...countedLeadWhere() },
      _max: { trackingReceivedAt: true },
    }),
    prisma.formMonitorLead.groupBy({
      by: ["siteId"],
      where: {
        siteId: { in: siteIds },
        formReceivedAt: inWindow,
        trackingReceivedAt: null,
        ...countedLeadWhere(),
      },
      _count: { _all: true },
    }),
    prisma.formMonitorLead.groupBy({
      by: ["siteId"],
      where: {
        siteId: { in: siteIds },
        formReceivedAt: inWindow,
        trackingReceivedAt: null,
        ignoredAt: null,
        ...countedLeadWhere(),
      },
      _count: { _all: true },
    }),
  ]);

  const lastFormBySite = new Map(lastForm.map((row) => [row.siteId, row._max.formReceivedAt]));
  const lastTrackingBySite = new Map(
    lastTracking.map((row) => [row.siteId, row._max.trackingReceivedAt])
  );
  const missingBySite = new Map(missing.map((row) => [row.siteId, row._count._all]));
  const openMissingBySite = new Map(openMissing.map((row) => [row.siteId, row._count._all]));

  const ordered = input.siteIds?.length
    ? input.siteIds
        .map((id) => sites.find((site) => site.id === id))
        .filter((site): site is (typeof sites)[number] => Boolean(site))
    : sortBySiteUrl(sites, (site) => site.url);

  return ordered.map((site) => ({
    id: site.id,
    url: site.url,
    label: site.label,
    lastFormAt: lastFormBySite.get(site.id)?.toISOString() ?? null,
    lastTrackingAt: lastTrackingBySite.get(site.id)?.toISOString() ?? null,
    missingCount: missingBySite.get(site.id) ?? 0,
    status: (openMissingBySite.get(site.id) ?? 0) > 0 ? "fail" : "pass",
  }));
}

export async function listRecentFormEvents(input: {
  siteIds?: string[];
  since: Date;
  until: Date;
  missingOnly?: boolean;
}): Promise<FormMonitorEventRecord[]> {
  const records = await prisma.formMonitorLead.findMany({
    where: {
      formReceivedAt: { gte: input.since, lte: input.until },
      ...(input.siteIds?.length ? { siteId: { in: input.siteIds } } : {}),
      ...(input.missingOnly
        ? { trackingReceivedAt: null, trackingId: null, ignoredAt: null, isSpam: false, isTest: false, deletedAt: null }
        : {}),
    },
    orderBy: { formReceivedAt: "desc" },
    take: FORM_MONITOR_EVENT_LIMIT,
    select: {
      id: true,
      referenceId: true,
      formTitle: true,
      isSpam: true,
      isTest: true,
      formId: true,
      entryId: true,
      formReceivedAt: true,
      trackingReceivedAt: true,
      trackingId: true,
      ignoredAt: true,
      deletedAt: true,
      siteId: true,
      site: { select: { url: true, label: true } },
    },
  });

  return records.map((record) => ({
    ...serializeLeadRecord(record),
    siteId: record.siteId,
    siteUrl: record.site?.url ?? null,
    siteLabel: record.site?.label ?? null,
    status: leadStatus(record),
  }));
}

const DAY_MS = 24 * 60 * 60 * 1000;
const BASELINE_DAYS = 30;
const TREND_BAND = 0.15;

type LeadSlice = {
  siteId: string | null;
  formReceivedAt: Date | null;
  trackingReceivedAt: Date | null;
  trackingId?: string | null;
  isSpam: boolean;
  isTest: boolean;
  deletedAt: Date | null;
  formId?: number | null;
  formTitle?: string | null;
};

function dayBuckets(since: Date, until: Date): FormMonitorDayBucket[] {
  const buckets: FormMonitorDayBucket[] = [];
  for (let time = startOfUtcDay(since).getTime(); time <= startOfUtcDay(until).getTime(); time += DAY_MS) {
    buckets.push({ date: utcDayKey(new Date(time)), submissions: 0, missing: 0, spam: 0, deleted: 0, test: 0 });
  }
  return buckets;
}

function fillDayBuckets(leads: LeadSlice[], since: Date, until: Date): FormMonitorDayBucket[] {
  const buckets = dayBuckets(since, until);
  const byDate = new Map(buckets.map((bucket) => [bucket.date, bucket]));

  for (const lead of leads) {
    if (!lead.formReceivedAt) continue;
    const bucket = byDate.get(utcDayKey(lead.formReceivedAt));
    if (!bucket) continue;
    if (lead.isTest) {
      bucket.test += 1;
      continue;
    }
    if (lead.deletedAt) {
      bucket.deleted += 1;
      continue;
    }
    if (lead.isSpam && !hasTracking(lead)) {
      bucket.spam += 1;
      continue;
    }
    bucket.submissions += 1;
    if (!hasTracking(lead)) bucket.missing += 1;
  }

  return buckets;
}

function totalsFromBuckets(buckets: FormMonitorDayBucket[]): FormMonitorTotals {
  const submitted = buckets.reduce((sum, bucket) => sum + bucket.submissions, 0);
  const missing = buckets.reduce((sum, bucket) => sum + bucket.missing, 0);
  const spam = buckets.reduce((sum, bucket) => sum + bucket.spam, 0);
  const deleted = buckets.reduce((sum, bucket) => sum + bucket.deleted, 0);
  const test = buckets.reduce((sum, bucket) => sum + bucket.test, 0);
  return {
    submitted,
    missing,
    spam,
    deleted,
    test,
    trackedRate: submitted === 0 ? null : (submitted - missing) / submitted,
  };
}

type LeadDailyStat = {
  siteId: string;
  day: string;
  test: number;
  deleted: number;
  spam: number;
  submissions: number;
  missing: number;
  spamDisagree: number;
};

function asCount(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function loadLeadDailyStats(siteIds: string[], since: Date, until: Date): Promise<LeadDailyStat[]> {
  if (siteIds.length === 0) return [];
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT
      "siteId",
      to_char(("formReceivedAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
      COUNT(*) FILTER (WHERE "isTest")::int AS test,
      COUNT(*) FILTER (WHERE NOT "isTest" AND "deletedAt" IS NOT NULL)::int AS deleted,
      COUNT(*) FILTER (
        WHERE NOT "isTest" AND "deletedAt" IS NULL AND "isSpam"
          AND "trackingReceivedAt" IS NULL AND "trackingId" IS NULL
      )::int AS spam,
      COUNT(*) FILTER (
        WHERE NOT "isTest" AND "deletedAt" IS NULL
          AND (NOT "isSpam" OR "trackingReceivedAt" IS NOT NULL OR "trackingId" IS NOT NULL)
      )::int AS submissions,
      COUNT(*) FILTER (
        WHERE NOT "isTest" AND "deletedAt" IS NULL
          AND (NOT "isSpam" OR "trackingReceivedAt" IS NOT NULL OR "trackingId" IS NOT NULL)
          AND "trackingReceivedAt" IS NULL AND "trackingId" IS NULL
      )::int AS missing,
      COUNT(*) FILTER (
        WHERE NOT "isTest" AND "deletedAt" IS NULL AND "isSpam"
          AND ("trackingReceivedAt" IS NOT NULL OR "trackingId" IS NOT NULL)
      )::int AS "spamDisagree"
    FROM "FormMonitorLead"
    WHERE "siteId" IN (${Prisma.join(siteIds)})
      AND "formReceivedAt" >= ${since}
      AND "formReceivedAt" <= ${until}
    GROUP BY 1, 2
  `);
  return rows.flatMap((row) => {
    if (typeof row.siteId !== "string" || typeof row.day !== "string") return [];
    return [
      {
        siteId: row.siteId,
        day: row.day,
        test: asCount(row.test),
        deleted: asCount(row.deleted),
        spam: asCount(row.spam),
        submissions: asCount(row.submissions),
        missing: asCount(row.missing),
        spamDisagree: asCount(row.spamDisagree),
      },
    ];
  });
}

function addDailyStat(bucket: FormMonitorDayBucket, row: LeadDailyStat) {
  bucket.test += row.test;
  bucket.deleted += row.deleted;
  bucket.spam += row.spam;
  bucket.submissions += row.submissions;
  bucket.missing += row.missing;
}

function formLabel(formId: number | null | undefined, formTitle: string | null | undefined) {
  if (formTitle) return formTitle;
  if (formId) return `Form ${formId}`;
  return "Untitled form";
}

function formSummaries(leads: LeadSlice[]): FormMonitorFormSummary[] {
  const groups = new Map<
    string,
    {
      formId: number | null;
      formTitle: string | null;
      lastFormAt: Date;
      lastTrackingAt: Date | null;
      submitted: number;
      missing: number;
    }
  >();

  for (const lead of leads) {
    if (!lead.formReceivedAt || !isCountedLead(lead)) continue;
    const key = lead.formId != null ? `id:${lead.formId}` : `title:${lead.formTitle ?? ""}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        formId: lead.formId ?? null,
        formTitle: lead.formTitle ?? null,
        lastFormAt: lead.formReceivedAt,
        lastTrackingAt: lead.trackingReceivedAt,
        submitted: 1,
        missing: lead.trackingReceivedAt ? 0 : 1,
      });
      continue;
    }
    existing.submitted += 1;
    if (!lead.trackingReceivedAt) existing.missing += 1;
    if (lead.formReceivedAt > existing.lastFormAt) existing.lastFormAt = lead.formReceivedAt;
    if (lead.formTitle && !existing.formTitle) existing.formTitle = lead.formTitle;
    if (lead.trackingReceivedAt && (!existing.lastTrackingAt || lead.trackingReceivedAt > existing.lastTrackingAt)) {
      existing.lastTrackingAt = lead.trackingReceivedAt;
    }
  }

  return [...groups.values()]
    .sort((a, b) => formLabel(a.formId, a.formTitle).localeCompare(formLabel(b.formId, b.formTitle)))
    .map((group) => ({
      formId: group.formId,
      formTitle: group.formTitle,
      lastFormAt: group.lastFormAt.toISOString(),
      lastTrackingAt: group.lastTrackingAt?.toISOString() ?? null,
      submitted: group.submitted,
      missing: group.missing,
      trackedRate: group.submitted === 0 ? null : (group.submitted - group.missing) / group.submitted,
    }));
}

function completeDayKeys(range: ResolvedFormMonitorRange, now: Date): string[] {
  const today = startOfUtcDay(now).getTime();
  const since = startOfUtcDay(range.since).getTime();
  const until = startOfUtcDay(range.until).getTime();
  const lastComplete = Math.min(until, today - DAY_MS);
  if (lastComplete < since) return [];
  const keys: string[] = [];
  for (let time = since; time <= lastComplete; time += DAY_MS) {
    keys.push(utcDayKey(new Date(time)));
  }
  return keys;
}

function baselineDayKeys(anchorKey: string): string[] {
  const anchor = startOfUtcDay(new Date(`${anchorKey}T00:00:00Z`)).getTime();
  const keys: string[] = [];
  for (let offset = BASELINE_DAYS - 1; offset >= 0; offset -= 1) {
    keys.push(utcDayKey(new Date(anchor - offset * DAY_MS)));
  }
  return keys;
}

function trendForCounts(
  counts: Map<string, number>,
  periodKeys: string[],
  firstAt: Date | null
): FormMonitorTrend {
  const flat: FormMonitorTrend = { direction: "flat", percent: null };
  if (periodKeys.length === 0) return flat;
  const anchorKey = periodKeys[periodKeys.length - 1];
  if (firstAt) {
    const ageDays = (startOfUtcDay(new Date(`${anchorKey}T00:00:00Z`)).getTime() - startOfUtcDay(firstAt).getTime()) / DAY_MS;
    if (ageDays < 6) return flat;
  } else {
    return flat;
  }

  const baselineKeys = baselineDayKeys(anchorKey);
  const periodTotal = periodKeys.reduce((sum, key) => sum + (counts.get(key) ?? 0), 0);
  const baselineTotal = baselineKeys.reduce((sum, key) => sum + (counts.get(key) ?? 0), 0);
  const periodRate = periodTotal / periodKeys.length;
  const baselineRate = baselineTotal / baselineKeys.length;
  if (baselineRate === 0) {
    return periodRate === 0 ? flat : { direction: "up", percent: null };
  }
  const change = (periodRate - baselineRate) / baselineRate;
  if (Math.abs(change) <= TREND_BAND) return flat;
  return {
    direction: change > 0 ? "up" : "down",
    percent: Math.round(Math.abs(change) * 100),
  };
}

export async function listOverview(rangeInput?: {
  range?: string | null;
  since?: string | null;
  until?: string | null;
  now?: Date;
}): Promise<{
  range: { id: string; since: string; until: string };
  totals: FormMonitorTotals;
  sites: FormMonitorSiteSummary[];
  days: FormMonitorDayBucket[];
}> {
  const now = rangeInput?.now ?? new Date();
  const range = resolveFormMonitorRange({ ...rangeInput, now });
  const sites = await prisma.site.findMany({
    where: activeSiteWhere,
    select: { id: true, url: true, label: true },
  });
  const siteIds = sites.map((site) => site.id);
  const periodKeys = completeDayKeys(range, now);
  const historyStart = periodKeys.length
    ? new Date(`${baselineDayKeys(periodKeys[periodKeys.length - 1])[0]}T00:00:00Z`)
    : range.since;
  const fetchSince = historyStart.getTime() < range.since.getTime() ? historyStart : range.since;

  const [lastForm, lastTracking, firstForm, daily] = siteIds.length
    ? await Promise.all([
        prisma.formMonitorLead.groupBy({
          by: ["siteId"],
          where: { siteId: { in: siteIds }, formReceivedAt: { not: null }, ...countedLeadWhere() },
          _max: { formReceivedAt: true },
        }),
        prisma.formMonitorLead.groupBy({
          by: ["siteId"],
          where: { siteId: { in: siteIds }, trackingReceivedAt: { not: null }, ...countedLeadWhere() },
          _max: { trackingReceivedAt: true },
        }),
        prisma.formMonitorLead.groupBy({
          by: ["siteId"],
          where: { siteId: { in: siteIds }, formReceivedAt: { not: null }, ...countedLeadWhere() },
          _min: { formReceivedAt: true },
        }),
        loadLeadDailyStats(siteIds, fetchSince, range.until),
      ])
    : [[], [], [], [] as LeadDailyStat[]];

  const lastFormBySite = new Map(lastForm.map((row) => [row.siteId, row._max.formReceivedAt]));
  const lastTrackingBySite = new Map(lastTracking.map((row) => [row.siteId, row._max.trackingReceivedAt]));
  const firstFormBySite = new Map(firstForm.map((row) => [row.siteId, row._min.formReceivedAt]));
  const sinceKey = utcDayKey(range.since);
  const untilKey = utcDayKey(range.until);
  const days = dayBuckets(range.since, range.until);
  const daysByDate = new Map(days.map((bucket) => [bucket.date, bucket]));
  const bySite = new Map<string, LeadDailyStat[]>();
  for (const row of daily) {
    const siteRows = bySite.get(row.siteId);
    if (siteRows) siteRows.push(row);
    else bySite.set(row.siteId, [row]);
    if (row.day >= sinceKey && row.day <= untilKey) {
      const bucket = daysByDate.get(row.day);
      if (bucket) addDailyStat(bucket, row);
    }
  }

  const rows = sortBySiteUrl(sites, (site) => site.url).map((site) => {
    const siteRows = bySite.get(site.id) ?? [];
    const counts = new Map<string, number>();
    let submitted = 0;
    let missing = 0;
    let spamDisagree = 0;
    for (const row of siteRows) {
      counts.set(row.day, (counts.get(row.day) ?? 0) + row.submissions);
      if (row.day < sinceKey || row.day > untilKey) continue;
      submitted += row.submissions;
      missing += row.missing;
      spamDisagree += row.spamDisagree;
    }
    return {
      id: site.id,
      url: site.url,
      label: site.label,
      lastFormAt: lastFormBySite.get(site.id)?.toISOString() ?? null,
      lastTrackingAt: lastTrackingBySite.get(site.id)?.toISOString() ?? null,
      submitted,
      missing,
      trackedRate: submitted === 0 ? null : (submitted - missing) / submitted,
      spamDisagreeCount: spamDisagree,
      trend: trendForCounts(counts, periodKeys, firstFormBySite.get(site.id) ?? null),
    };
  });

  return {
    range: { id: range.id, since: range.since.toISOString(), until: range.until.toISOString() },
    totals: totalsFromBuckets(days),
    sites: rows,
    days,
  };
}

export async function getSiteChart(
  siteId: string,
  rangeInput?: {
    range?: string | null;
    since?: string | null;
    until?: string | null;
    now?: Date;
    series?: string | null;
  }
) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, url: true, label: true, status: true },
  });
  if (!site) return null;

  const now = rangeInput?.now ?? new Date();
  const range = resolveFormMonitorRange({ ...rangeInput, now });
  const series = resolveFormMonitorSeries(rangeInput?.series);
  const [leads, recent] = await Promise.all([
    prisma.formMonitorLead.findMany({
      where: { siteId, formReceivedAt: { gte: range.since, lte: range.until } },
      select: {
        siteId: true,
        formReceivedAt: true,
        trackingReceivedAt: true,
        trackingId: true,
        isSpam: true,
        isTest: true,
        deletedAt: true,
        formId: true,
        formTitle: true,
      },
    }),
    listSiteRecords({ siteId, series }),
  ]);

  const days = fillDayBuckets(leads, range.since, range.until);
  return {
    site: { id: site.id, url: site.url, label: site.label },
    range: { id: range.id, since: range.since.toISOString(), until: range.until.toISOString() },
    totals: totalsFromBuckets(days),
    days,
    forms: formSummaries(leads),
    records: recent.records,
    nextCursor: recent.nextCursor,
  };
}

const leadRecordSelect = {
  id: true,
  referenceId: true,
  formTitle: true,
  isSpam: true,
  isTest: true,
  formId: true,
  entryId: true,
  formReceivedAt: true,
  trackingReceivedAt: true,
  trackingId: true,
  ignoredAt: true,
  deletedAt: true,
} as const;

export async function listSiteRecords(input: {
  siteId: string;
  series: FormMonitorSeriesId[];
  cursor?: string | null;
  take?: number;
}): Promise<{ records: FormMonitorLeadRecord[]; nextCursor: string | null }> {
  const take = input.take ?? FORM_MONITOR_EVENT_LIMIT;
  const cursorFilter = await recordsCursorFilter(input.siteId, input.cursor);
  const rows = await prisma.formMonitorLead.findMany({
    where: {
      siteId: input.siteId,
      formReceivedAt: { not: null },
      AND: [recordsWhere(input.series), cursorFilter],
    },
    orderBy: [{ formReceivedAt: "desc" }, { id: "desc" }],
    take: take + 1,
    select: leadRecordSelect,
  });
  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  return {
    records: page.map(serializeLeadRecord),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

async function recordsCursorFilter(siteId: string, cursor?: string | null): Promise<Prisma.FormMonitorLeadWhereInput> {
  if (!cursor) return {};
  const row = await prisma.formMonitorLead.findUnique({
    where: { id: cursor },
    select: { id: true, siteId: true, formReceivedAt: true },
  });
  if (!row?.formReceivedAt || row.siteId !== siteId) return {};
  return {
    OR: [
      { formReceivedAt: { lt: row.formReceivedAt } },
      { formReceivedAt: row.formReceivedAt, id: { lt: row.id } },
    ],
  };
}

function recordsWhere(series: FormMonitorSeriesId[]): Prisma.FormMonitorLeadWhereInput {
  const clauses: Prisma.FormMonitorLeadWhereInput[] = [];
  if (series.includes("test")) clauses.push({ isTest: true });
  if (series.includes("deleted")) clauses.push({ isTest: false, deletedAt: { not: null } });
  if (series.includes("spam")) {
    clauses.push({
      isTest: false,
      deletedAt: null,
      isSpam: true,
      trackingReceivedAt: null,
      trackingId: null,
    });
  }
  if (series.includes("missing")) {
    clauses.push({
      isTest: false,
      deletedAt: null,
      isSpam: false,
      trackingReceivedAt: null,
      trackingId: null,
      ignoredAt: null,
    });
  }
  if (series.includes("submissions")) {
    clauses.push({
      isTest: false,
      deletedAt: null,
      OR: [
        { trackingReceivedAt: { not: null } },
        { trackingId: { not: null } },
        { isSpam: false, ignoredAt: { not: null } },
      ],
    });
  }
  if (clauses.length === 0) return { id: { in: [] } };
  return { OR: clauses };
}

export async function markSiteMissingIgnored(siteId: string): Promise<number> {
  const result = await prisma.formMonitorLead.updateMany({
    where: {
      siteId,
      formReceivedAt: { not: null },
      trackingReceivedAt: null,
      trackingId: null,
      ignoredAt: null,
      ...countedLeadWhere(),
    },
    data: { ignoredAt: new Date() },
  });
  return result.count;
}

function serializeLeadRecord(lead: {
  id: string;
  referenceId: string;
  formTitle: string | null;
  isSpam: boolean;
  isTest: boolean;
  formId: number | null;
  entryId: number | null;
  formReceivedAt: Date | null;
  trackingReceivedAt: Date | null;
  trackingId: string | null;
  ignoredAt: Date | null;
  deletedAt: Date | null;
}): FormMonitorLeadRecord {
  return {
    id: lead.id,
    referenceId: lead.referenceId,
    formTitle: lead.formTitle,
    isSpam: lead.isSpam,
    isTest: lead.isTest,
    formId: lead.formId,
    entryId: lead.entryId,
    formReceivedAt: lead.formReceivedAt?.toISOString() ?? null,
    trackingReceivedAt: lead.trackingReceivedAt?.toISOString() ?? null,
    trackingId: lead.trackingId,
    ignoredAt: lead.ignoredAt?.toISOString() ?? null,
    deletedAt: lead.deletedAt?.toISOString() ?? null,
  };
}