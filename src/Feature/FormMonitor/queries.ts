import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { activeSiteWhere } from "@/lib/site-status";
import { sortBySiteUrl } from "@/lib/site-url";
import type {
  FormMonitorDayBucket,
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

function countedLeadWhere() {
  return { isSpam: false, isTest: false, deletedAt: null };
}

function leadStatus(record: {
  trackingReceivedAt: Date | string | null;
  ignoredAt: Date | string | null;
  deletedAt?: Date | string | null;
  isSpam: boolean;
  isTest?: boolean;
}): "tracked" | "missing" | "fixed" | "spam" | "test" | "deleted" {
  if (record.isTest) return "test";
  if (record.deletedAt) return "deleted";
  if (record.isSpam) return "spam";
  if (record.trackingReceivedAt) return "tracked";
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
      where: { siteId: { in: siteIds }, trackingReceivedAt: { not: null } },
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
        ? { trackingReceivedAt: null, ignoredAt: null, isSpam: false, isTest: false, deletedAt: null }
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
  isSpam: boolean;
  isTest: boolean;
  deletedAt: Date | null;
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
    if (lead.isSpam) {
      bucket.spam += 1;
      continue;
    }
    bucket.submissions += 1;
    if (!lead.trackingReceivedAt) bucket.missing += 1;
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

function siteDayCounts(leads: LeadSlice[], siteId: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    if (lead.siteId !== siteId || lead.isSpam || lead.isTest || lead.deletedAt || !lead.formReceivedAt) continue;
    const key = utcDayKey(lead.formReceivedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
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

  const [lastForm, lastTracking, firstForm, leads] = siteIds.length
    ? await Promise.all([
        prisma.formMonitorLead.groupBy({
          by: ["siteId"],
          where: { siteId: { in: siteIds }, formReceivedAt: { not: null }, ...countedLeadWhere() },
          _max: { formReceivedAt: true },
        }),
        prisma.formMonitorLead.groupBy({
          by: ["siteId"],
          where: { siteId: { in: siteIds }, trackingReceivedAt: { not: null } },
          _max: { trackingReceivedAt: true },
        }),
        prisma.formMonitorLead.groupBy({
          by: ["siteId"],
          where: { siteId: { in: siteIds }, formReceivedAt: { not: null }, ...countedLeadWhere() },
          _min: { formReceivedAt: true },
        }),
        prisma.formMonitorLead.findMany({
          where: { siteId: { in: siteIds }, formReceivedAt: { gte: fetchSince, lte: range.until } },
          select: { siteId: true, formReceivedAt: true, trackingReceivedAt: true, isSpam: true, isTest: true, deletedAt: true },
        }),
      ])
    : [[], [], [], []];

  const lastFormBySite = new Map(lastForm.map((row) => [row.siteId, row._max.formReceivedAt]));
  const lastTrackingBySite = new Map(lastTracking.map((row) => [row.siteId, row._max.trackingReceivedAt]));
  const firstFormBySite = new Map(firstForm.map((row) => [row.siteId, row._min.formReceivedAt]));
  const days = fillDayBuckets(leads, range.since, range.until);

  const rows = sortBySiteUrl(sites, (site) => site.url).map((site) => {
    const siteLeads = leads.filter((lead) => lead.siteId === site.id);
    const siteDays = fillDayBuckets(siteLeads, range.since, range.until);
    const totals = totalsFromBuckets(siteDays);
    return {
      id: site.id,
      url: site.url,
      label: site.label,
      lastFormAt: lastFormBySite.get(site.id)?.toISOString() ?? null,
      lastTrackingAt: lastTrackingBySite.get(site.id)?.toISOString() ?? null,
      submitted: totals.submitted,
      missing: totals.missing,
      trackedRate: totals.trackedRate,
      trend: trendForCounts(siteDayCounts(siteLeads, site.id), periodKeys, firstFormBySite.get(site.id) ?? null),
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
      select: { siteId: true, formReceivedAt: true, trackingReceivedAt: true, isSpam: true, isTest: true, deletedAt: true },
    }),
    prisma.formMonitorLead.findMany({
      where: { siteId, ...recordsWhere(series) },
      orderBy: { createdAt: "desc" },
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
      },
    }),
  ]);

  const days = fillDayBuckets(leads, range.since, range.until);
  return {
    site: { id: site.id, url: site.url, label: site.label },
    range: { id: range.id, since: range.since.toISOString(), until: range.until.toISOString() },
    totals: totalsFromBuckets(days),
    days,
    records: recent.map(serializeLeadRecord),
  };
}

function recordsWhere(series: FormMonitorSeriesId[]): Prisma.FormMonitorLeadWhereInput {
  const clauses: Prisma.FormMonitorLeadWhereInput[] = [];
  if (series.includes("test")) clauses.push({ isTest: true });
  if (series.includes("deleted")) clauses.push({ isTest: false, deletedAt: { not: null } });
  if (series.includes("spam")) clauses.push({ isTest: false, deletedAt: null, isSpam: true });
  if (series.includes("missing")) {
    clauses.push({
      isTest: false,
      deletedAt: null,
      isSpam: false,
      trackingReceivedAt: null,
      ignoredAt: null,
    });
  }
  if (series.includes("submissions")) {
    clauses.push({
      isTest: false,
      deletedAt: null,
      isSpam: false,
      OR: [{ trackingReceivedAt: { not: null } }, { ignoredAt: { not: null } }],
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