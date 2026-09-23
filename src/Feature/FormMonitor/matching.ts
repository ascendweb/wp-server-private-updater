import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { enqueueCheckTracking } from "./jobs";
import { getFormMonitorSettings } from "./webhook-token";
import type { FormMonitorFieldValue } from "./protocol";

function sourceUrlHasTestParam(sourceUrl: string | null, params: string[]): boolean {
  if (!sourceUrl || params.length === 0) return false;
  try {
    const url = new URL(sourceUrl, "https://placeholder.invalid");
    const names = new Set(params.map((param) => param.toLowerCase()));
    for (const key of url.searchParams.keys()) {
      if (names.has(key.toLowerCase())) return true;
    }
  } catch {
    return false;
  }
  return false;
}

export async function recordFormEvent(input: {
  siteId: string;
  referenceId: string;
  formId: number | null;
  entryId: number | null;
  formTitle: string | null;
  submittedAt: Date;
  spam: boolean;
  sourceUrl: string | null;
  fields: FormMonitorFieldValue[] | null;
}) {
  const settings = await getFormMonitorSettings();
  const isTest = sourceUrlHasTestParam(input.sourceUrl, settings.testQueryParams);
  const fields = input.fields === null ? Prisma.JsonNull : input.fields;

  const lead = await prisma.formMonitorLead.upsert({
    where: { referenceId: input.referenceId },
    create: {
      referenceId: input.referenceId,
      siteId: input.siteId,
      formId: input.formId,
      entryId: input.entryId,
      formTitle: input.formTitle,
      sourceUrl: input.sourceUrl,
      fields,
      isSpam: input.spam,
      isTest,
      formReceivedAt: input.submittedAt,
    },
    update: {
      siteId: input.siteId,
      formId: input.formId ?? undefined,
      entryId: input.entryId ?? undefined,
      formTitle: input.formTitle ?? undefined,
      sourceUrl: input.sourceUrl ?? undefined,
      fields: input.fields === null ? undefined : fields,
      isSpam: input.spam ? true : undefined,
      isTest: isTest ? true : undefined,
      formReceivedAt: input.submittedAt,
    },
  });

  if (!lead.trackingReceivedAt && !lead.isSpam && !lead.isTest) {
    await enqueueCheckTracking(input.referenceId);
  }

  return lead;
}

export async function recordTrackingEvent(input: {
  referenceId: string;
  trackingId: string | null;
  receivedAt: Date;
}) {
  return prisma.formMonitorLead.upsert({
    where: { referenceId: input.referenceId },
    create: {
      referenceId: input.referenceId,
      trackingId: input.trackingId,
      trackingReceivedAt: input.receivedAt,
    },
    update: {
      trackingId: input.trackingId ?? undefined,
      trackingReceivedAt: input.receivedAt,
    },
  });
}

export async function recordDeletedEntry(input: { siteId: string; entryId: number }): Promise<number> {
  const result = await prisma.formMonitorLead.updateMany({
    where: {
      siteId: input.siteId,
      entryId: input.entryId,
      isTest: false,
      deletedAt: null,
    },
    data: { deletedAt: new Date() },
  });
  return result.count;
}
