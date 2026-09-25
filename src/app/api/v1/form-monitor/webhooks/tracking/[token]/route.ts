import { NextRequest, NextResponse } from "next/server";
import { recordTrackingEvent } from "@/Feature/FormMonitor/matching";
import {
  TRACKING_PLATFORM_WHATCONVERTS,
  extractReferenceId,
  extractTrackingId,
  extractTrackingMeta,
  extractTrackingSpam,
} from "@/Feature/FormMonitor/protocol";
import { getFormMonitorSettings, tokensMatch } from "@/Feature/FormMonitor/webhook-token";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const settings = await getFormMonitorSettings();
  if (!tokensMatch(settings.trackingWebhookToken, token)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payload = await req.json().catch(() => null);
  const referenceId = extractReferenceId(payload);
  if (!referenceId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  await recordTrackingEvent({
    referenceId,
    trackingId: extractTrackingId(payload),
    trackingPlatform: TRACKING_PLATFORM_WHATCONVERTS,
    trackingMeta: extractTrackingMeta(payload),
    isTrackingSpam: extractTrackingSpam(payload),
    receivedAt: new Date(),
  });

  return NextResponse.json({ ok: true });
}
