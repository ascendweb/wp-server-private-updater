import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getFormMonitorSettings,
  isAllowedWebhookUrl,
  normalizeCheckDelayMinutes,
  rotateTrackingWebhookToken,
  saveMissingSettings,
  trackingWebhookUrl,
} from "@/Feature/FormMonitor/webhook-token";
import { DEFAULT_CHECK_DELAY_MINUTES } from "@/Feature/FormMonitor/protocol";

function serializeSettings(settings: {
  trackingWebhookToken: string;
  missingWebhookUrl: string | null;
  checkDelayMinutes: number;
}) {
  return {
    trackingWebhookUrl: trackingWebhookUrl(settings.trackingWebhookToken),
    missingWebhookUrl: settings.missingWebhookUrl,
    checkDelayMinutes: settings.checkDelayMinutes ?? DEFAULT_CHECK_DELAY_MINUTES,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getFormMonitorSettings();
  return NextResponse.json(serializeSettings(settings));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "rotate-tracking") {
    const settings = await rotateTrackingWebhookToken();
    return NextResponse.json(serializeSettings(settings));
  }

  if (action === "save-missing") {
    const raw = typeof body.missingWebhookUrl === "string" ? body.missingWebhookUrl.trim() : "";
    if (raw && !isAllowedWebhookUrl(raw)) {
      return NextResponse.json({ error: "Missing webhook URL must be http or https" }, { status: 400 });
    }
    const delay = normalizeCheckDelayMinutes(body.checkDelayMinutes);
    if (delay === null) {
      return NextResponse.json({ error: "Delay must be a whole number of minutes (0 or more)" }, { status: 400 });
    }
    const settings = await saveMissingSettings({
      missingWebhookUrl: raw || null,
      checkDelayMinutes: delay,
    });
    return NextResponse.json(serializeSettings(settings));
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
