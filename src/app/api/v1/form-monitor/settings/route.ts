import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getFormMonitorSettings,
  isAllowedWebhookUrl,
  rotateTrackingWebhookToken,
  saveMissingWebhookUrl,
  trackingWebhookUrl,
} from "@/Feature/FormMonitor/webhook-token";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getFormMonitorSettings();
  return NextResponse.json({
    trackingWebhookUrl: trackingWebhookUrl(settings.trackingWebhookToken),
    missingWebhookUrl: settings.missingWebhookUrl,
  });
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
    return NextResponse.json({
      trackingWebhookUrl: trackingWebhookUrl(settings.trackingWebhookToken),
      missingWebhookUrl: settings.missingWebhookUrl,
    });
  }

  if (action === "save-missing-url") {
    const raw = typeof body.missingWebhookUrl === "string" ? body.missingWebhookUrl.trim() : "";
    if (raw && !isAllowedWebhookUrl(raw)) {
      return NextResponse.json({ error: "Missing webhook URL must be http or https" }, { status: 400 });
    }
    const settings = await saveMissingWebhookUrl(raw || null);
    return NextResponse.json({
      trackingWebhookUrl: trackingWebhookUrl(settings.trackingWebhookToken),
      missingWebhookUrl: settings.missingWebhookUrl,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}