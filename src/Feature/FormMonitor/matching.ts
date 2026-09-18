import { prisma } from "@/lib/db";
import { enqueueCheckTracking } from "./jobs";

export async function recordFormEvent(input: {
  siteId: string;
  referenceId: string;
  formId: number | null;
  entryId: number | null;
  formTitle: string | null;
  submittedAt: Date;
}) {
  const lead = await prisma.formMonitorLead.upsert({
    where: { referenceId: input.referenceId },
    create: {
      referenceId: input.referenceId,
      siteId: input.siteId,
      formId: input.formId,
      entryId: input.entryId,
      formTitle: input.formTitle,
      formReceivedAt: input.submittedAt,
    },
    update: {
      siteId: input.siteId,
      formId: input.formId ?? undefined,
      entryId: input.entryId ?? undefined,
      formTitle: input.formTitle ?? undefined,
      formReceivedAt: input.submittedAt,
    },
  });

  if (!lead.trackingReceivedAt) {
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