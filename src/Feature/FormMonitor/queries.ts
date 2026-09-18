import { prisma } from "@/lib/db";
import { activeSiteWhere } from "@/lib/site-status";
import { sortBySiteUrl } from "@/lib/site-url";
import type { FormMonitorDayBucket, FormMonitorLeadRecord, FormMonitorSiteSummary } from "./types";
import { FORM_MONITOR_EVENT_LIMIT } from "./protocol";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
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
  status: "tracked" | "missing" | "fixed";
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

function leadStatus(record: { trackingReceivedAt: Date | string | null; ignoredAt: Date | string | null }): "tracked" | "missing" | "fixed" {
  if (record.trackingReceivedAt) return "tracked";
  if (record.ignoredAt) return "fixed";
  return "missing";
}

export async function listSiteSummaries(): Promise<FormMonitorSiteSummary[]> {
  const until = new Date();
  const since = new Date(until.getTime() - WEEK_MS);
  const rows = await listSiteSummariesInRange({ since, until });
  return rows.map((row) => ({
    id: row.id,
    url: row.url,
    label: row.label,
    lastFormAt: row.lastFormAt,
    lastTrackingAt: row.lastTrackingAt,
    missingLast7Days: row.missingCount,
    status: row.status,
  }));
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
      where: { siteId: { in: siteIds }, formReceivedAt: { not: null } },
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
        ? { trackingReceivedAt: null, ignoredAt: null }
        : {}),
    },
    orderBy: { formReceivedAt: "desc" },
    take: FORM_MONITOR_EVENT_LIMIT,
    select: {
      id: true,
      referenceId: true,
      formTitle: true,
      formId: true,
      entryId: true,
      formReceivedAt: true,
      trackingReceivedAt: true,
      ignoredAt: true,
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

function emptyWeekBuckets(start: Date): FormMonitorDayBucket[] {
  const buckets: FormMonitorDayBucket[] = [];
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    buckets.push({ date: utcDateKey(day), submissions: 0, missing: 0 });
  }
  return buckets;
}

function fillDayBuckets(
  leads: { formReceivedAt: Date | null; trackingReceivedAt: Date | null }[],
  start: Date
): FormMonitorDayBucket[] {
  const buckets = emptyWeekBuckets(start);
  const byDate = new Map(buckets.map((bucket) => [bucket.date, bucket]));

  for (const lead of leads) {
    if (!lead.formReceivedAt) continue;
    const bucket = byDate.get(utcDateKey(lead.formReceivedAt));
    if (!bucket) continue;
    bucket.submissions += 1;
    if (!lead.trackingReceivedAt) bucket.missing += 1;
  }

  return buckets;
}

function chartWindowStart(): Date {
  return startOfUtcDay(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
}

export async function listOverview(): Promise<{
  sites: FormMonitorSiteSummary[];
  days: FormMonitorDayBucket[];
}> {
  const sites = await listSiteSummaries();
  const start = chartWindowStart();
  const siteIds = sites.map((site) => site.id);
  const leads =
    siteIds.length === 0
      ? []
      : await prisma.formMonitorLead.findMany({
          where: {
            siteId: { in: siteIds },
            formReceivedAt: { gte: start },
          },
          select: {
            formReceivedAt: true,
            trackingReceivedAt: true,
          },
        });

  return {
    sites,
    days: fillDayBuckets(leads, start),
  };
}

export async function getSiteChart(siteId: string) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, url: true, label: true, status: true },
  });
  if (!site) return null;

  const start = chartWindowStart();
  const [leads, recent] = await Promise.all([
    prisma.formMonitorLead.findMany({
      where: {
        siteId,
        formReceivedAt: { gte: start },
      },
      select: {
        formReceivedAt: true,
        trackingReceivedAt: true,
      },
    }),
    prisma.formMonitorLead.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
      take: FORM_MONITOR_EVENT_LIMIT,
      select: {
        id: true,
        referenceId: true,
        formTitle: true,
        formId: true,
        entryId: true,
        formReceivedAt: true,
        trackingReceivedAt: true,
        ignoredAt: true,
      },
    }),
  ]);

  return {
    site: {
      id: site.id,
      url: site.url,
      label: site.label,
    },
    days: fillDayBuckets(leads, start),
    records: recent.map(serializeLeadRecord),
  };
}

export async function markSiteMissingIgnored(siteId: string): Promise<number> {
  const result = await prisma.formMonitorLead.updateMany({
    where: {
      siteId,
      formReceivedAt: { not: null },
      trackingReceivedAt: null,
      ignoredAt: null,
    },
    data: { ignoredAt: new Date() },
  });
  return result.count;
}

function serializeLeadRecord(lead: {
  id: string;
  referenceId: string;
  formTitle: string | null;
  formId: number | null;
  entryId: number | null;
  formReceivedAt: Date | null;
  trackingReceivedAt: Date | null;
  ignoredAt: Date | null;
}): FormMonitorLeadRecord {
  return {
    id: lead.id,
    referenceId: lead.referenceId,
    formTitle: lead.formTitle,
    formId: lead.formId,
    entryId: lead.entryId,
    formReceivedAt: lead.formReceivedAt?.toISOString() ?? null,
    trackingReceivedAt: lead.trackingReceivedAt?.toISOString() ?? null,
    ignoredAt: lead.ignoredAt?.toISOString() ?? null,
  };
}