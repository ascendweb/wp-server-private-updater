import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getFormMonitorSettings,
  isAllowedWebhookUrl,
  normalizeCheckDelayMinutes,
  normalizeTestQueryParams,
  normalizeTrendAbsDelta,
  normalizeTrendBandPercent,
  rotateTrackingWebhookToken,
  saveMissingSettings,
  saveTestQueryParams,
  saveTrendSettings,
  saveWhatConvertsUrl,
  trackingWebhookUrl,
} from "@/Feature/FormMonitor/webhook-token";
import {
  DEFAULT_CHECK_DELAY_MINUTES,
  DEFAULT_TEST_QUERY_PARAMS,
  DEFAULT_TREND_ABS_DELTA,
  DEFAULT_TREND_BAND_PERCENT,
  normalizeTrackingOrigin,
} from "@/Feature/FormMonitor/protocol";

function serializeSettings(settings: {
  trackingWebhookToken: string;
  missingWebhookUrl: string | null;
  checkDelayMinutes: number;
  testQueryParams: string[];
  trendBandPercent: number;
  trendAbsDelta: number;
  whatConvertsUrl: string | null;
}) {
  return {
    trackingWebhookUrl: trackingWebhookUrl(settings.trackingWebhookToken),
    missingWebhookUrl: settings.missingWebhookUrl,
    checkDelayMinutes: settings.checkDelayMinutes ?? DEFAULT_CHECK_DELAY_MINUTES,
    testQueryParams: (settings.testQueryParams ?? DEFAULT_TEST_QUERY_PARAMS).join(", "),
    trendBandPercent: settings.trendBandPercent ?? DEFAULT_TREND_BAND_PERCENT,
    trendAbsDelta: settings.trendAbsDelta ?? DEFAULT_TREND_ABS_DELTA,
    whatConvertsUrl: settings.whatConvertsUrl,
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

  if (action === "save-test-params") {
    const settings = await saveTestQueryParams(normalizeTestQueryParams(body.testQueryParams));
    return NextResponse.json(serializeSettings(settings));
  }

  if (action === "save-trend") {
    const band = normalizeTrendBandPercent(body.trendBandPercent);
    const absDelta = normalizeTrendAbsDelta(body.trendAbsDelta);
    if (band === null) {
      return NextResponse.json({ error: "Percent band must be a whole number from 0 to 100" }, { status: 400 });
    }
    if (absDelta === null) {
      return NextResponse.json({ error: "Form floor must be a whole number of 0 or more" }, { status: 400 });
    }
    const settings = await saveTrendSettings({ trendBandPercent: band, trendAbsDelta: absDelta });
    return NextResponse.json(serializeSettings(settings));
  }

  if (action === "save-whatconverts") {
    const raw = typeof body.whatConvertsUrl === "string" ? body.whatConvertsUrl.trim() : "";
    if (raw && !normalizeTrackingOrigin(raw)) {
      return NextResponse.json({ error: "WhatConverts URL must be http or https" }, { status: 400 });
    }
    const settings = await saveWhatConvertsUrl(raw ? normalizeTrackingOrigin(raw) : null);
    return NextResponse.json(serializeSettings(settings));
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
