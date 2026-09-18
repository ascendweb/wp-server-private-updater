import { PgBoss } from "pg-boss";
import { prisma } from "@/lib/db";
import { CHECK_TRACKING_QUEUE } from "./protocol";
import { getFormMonitorSettings } from "./webhook-token";

const globalForBoss = globalThis as unknown as {
  formMonitorBoss?: Promise<PgBoss>;
  formMonitorWorker?: Promise<void>;
};

function checkDelaySeconds(): number {
  const raw = process.env.FORM_MONITOR_CHECK_DELAY_SECONDS;
  if (!raw) return 3600;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 3600;
}

async function createBoss(): Promise<PgBoss> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set");
  }

  const boss = new PgBoss({ connectionString });
  boss.on("error", (error) => {
    console.error("[form-monitor] pg-boss error", error);
  });
  await boss.start();
  const existing = await boss.getQueue(CHECK_TRACKING_QUEUE);
  if (!existing) {
    await boss.createQueue(CHECK_TRACKING_QUEUE);
  }
  return boss;
}

async function getBoss(): Promise<PgBoss> {
  if (!globalForBoss.formMonitorBoss) {
    globalForBoss.formMonitorBoss = createBoss();
  }
  return globalForBoss.formMonitorBoss;
}

export async function enqueueCheckTracking(referenceId: string): Promise<void> {
  const boss = await getBoss();
  await boss.send(
    CHECK_TRACKING_QUEUE,
    { referenceId },
    {
      startAfter: checkDelaySeconds(),
      singletonKey: referenceId,
    }
  );
}

export async function handleCheckTracking(referenceId: string): Promise<void> {
  const lead = await prisma.formMonitorLead.findUnique({
    where: { referenceId },
    include: { site: { select: { url: true, label: true } } },
  });

  if (!lead?.formReceivedAt || lead.trackingReceivedAt || lead.missingNotifiedAt || lead.ignoredAt) {
    return;
  }

  const settings = await getFormMonitorSettings();
  if (!settings.missingWebhookUrl) {
    return;
  }

  const response = await fetch(settings.missingWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "form_monitor.tracking_missing",
      referenceId: lead.referenceId,
      siteUrl: lead.site?.url ?? null,
      formId: lead.formId,
      entryId: lead.entryId,
      formTitle: lead.formTitle,
      formReceivedAt: lead.formReceivedAt.toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Missing webhook returned HTTP ${response.status}`);
  }

  await prisma.formMonitorLead.update({
    where: { id: lead.id },
    data: { missingNotifiedAt: new Date() },
  });
}

export async function startFormMonitorWorker(): Promise<void> {
  if (!globalForBoss.formMonitorWorker) {
    globalForBoss.formMonitorWorker = (async () => {
      const boss = await getBoss();
      await boss.work<{ referenceId: string }>(CHECK_TRACKING_QUEUE, async ([job]) => {
        if (!job?.data?.referenceId) return;
        await handleCheckTracking(job.data.referenceId);
      });
    })();
  }
  await globalForBoss.formMonitorWorker;
}