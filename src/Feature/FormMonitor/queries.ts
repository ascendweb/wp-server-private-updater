import { prisma } from "@/lib/db";
import { activeSiteWhere } from "@/lib/site-status";
import { sortBySiteUrl } from "@/lib/site-url";
import type { FormMonitorDayBucket, FormMonitorLeadRecord, FormMonitorSiteSummary } from "./types";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function listSiteSummaries(): Promise<FormMonitorSiteSummary[]> {
  const since = new Date(Date.now() - WEEK_MS);
  const sites = await prisma.site.findMany({
    where: activeSiteWhere,
    select: { id: true, url: true, label: true },
  });

  if (sites.length === 0) return [];

  const siteIds = sites.map((site) => site.id);

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
        formReceivedAt: { gte: since },
        trackingReceivedAt: null,
      },
      _count: { _all: true },
    }),
    prisma.formMonitorLead.groupBy({
      by: ["siteId"],
      where: {
        siteId: { in: siteIds },
        formReceivedAt: { gte: since },
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

  return sortBySiteUrl(
    sites.map((site) => ({
      id: site.id,
      url: site.url,
      label: site.label,
      lastFormAt: lastFormBySite.get(site.id)?.toISOString() ?? null,
      lastTrackingAt: lastTrackingBySite.get(site.id)?.toISOString() ?? null,
      missingLast7Days: missingBySite.get(site.id) ?? 0,
      status: (openMissingBySite.get(site.id) ?? 0) > 0 ? "fail" : "pass",
    })),
    (site) => site.url
  );
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
      take: 15,
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