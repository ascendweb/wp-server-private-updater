import { randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { getServerOriginFromEnv } from "@/lib/utils";

const SETTING_ID = "default";

export function newWebhookToken(): string {
  return randomBytes(32).toString("hex");
}

export function tokensMatch(expected: string, provided: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function getFormMonitorSettings() {
  const existing = await prisma.formMonitorSetting.findUnique({ where: { id: SETTING_ID } });
  if (existing) return existing;

  return prisma.formMonitorSetting.create({
    data: {
      id: SETTING_ID,
      trackingWebhookToken: newWebhookToken(),
    },
  });
}

export async function rotateTrackingWebhookToken() {
  const token = newWebhookToken();
  return prisma.formMonitorSetting.upsert({
    where: { id: SETTING_ID },
    create: { id: SETTING_ID, trackingWebhookToken: token },
    update: { trackingWebhookToken: token },
  });
}

export async function saveMissingSettings(input: {
  missingWebhookUrl: string | null;
  checkDelayMinutes: number;
}) {
  await getFormMonitorSettings();
  return prisma.formMonitorSetting.update({
    where: { id: SETTING_ID },
    data: {
      missingWebhookUrl: input.missingWebhookUrl,
      checkDelayMinutes: input.checkDelayMinutes,
    },
  });
}

export function normalizeCheckDelayMinutes(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number.parseInt(value, 10)
        : NaN;
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

export function trackingWebhookUrl(token: string): string {
  return `${getServerOriginFromEnv()}/api/v1/form-monitor/webhooks/tracking/${token}`;
}

export function isAllowedWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}