import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordTrackingEvent } from "@/Feature/FormMonitor/matching";
import {
  extractReferenceId,
  extractTrackingId,
  isTrackingUpdate,
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

  if (isTrackingUpdate(payload)) {
    const existing = await prisma.formMonitorLead.findUnique({
      where: { referenceId },
      select: { trackingReceivedAt: true },
    });
    if (existing?.trackingReceivedAt) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  await recordTrackingEvent({
    referenceId,
    trackingId: extractTrackingId(payload),
    receivedAt: new Date(),
  });

  return NextResponse.json({ ok: true });
}