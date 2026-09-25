"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePageHeader } from "@/components/page-header";

type SettingsPayload = {
  trackingWebhookUrl: string;
  missingWebhookUrl: string | null;
  checkDelayMinutes: number;
  testQueryParams: string;
  trendBandPercent: number;
  trendAbsDelta: number;
  whatConvertsUrl: string | null;
};

export function FormMonitorSettingsClient() {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [missingUrl, setMissingUrl] = useState("");
  const [delayMinutes, setDelayMinutes] = useState("60");
  const [testParams, setTestParams] = useState("checkview_test_id");
  const [trendBand, setTrendBand] = useState("15");
  const [trendAbs, setTrendAbs] = useState("2");
  const [whatConvertsUrl, setWhatConvertsUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTests, setSavingTests] = useState(false);
  const [savingTrend, setSavingTrend] = useState(false);
  const [savingWhatConverts, setSavingWhatConverts] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotating, setRotating] = useState(false);

  usePageHeader("Settings", undefined, {
    crumbs: [
      { label: "Form Monitor", href: "/form-monitor" },
      { label: "Settings" },
    ],
  });

  async function load() {
    const res = await fetch("/api/v1/form-monitor/settings");
    if (res.ok) {
      const data = (await res.json()) as SettingsPayload;
      setSettings(data);
      setMissingUrl(data.missingWebhookUrl ?? "");
      setDelayMinutes(String(data.checkDelayMinutes ?? 60));
      setTestParams(data.testQueryParams ?? "checkview_test_id");
      setTrendBand(String(data.trendBandPercent ?? 15));
      setTrendAbs(String(data.trendAbsDelta ?? 2));
      setWhatConvertsUrl(data.whatConvertsUrl ?? "");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function copyTrackingUrl() {
    if (!settings?.trackingWebhookUrl) return;
    navigator.clipboard.writeText(settings.trackingWebhookUrl);
    toast.success("Tracking webhook URL copied");
  }

  async function rotateTracking() {
    setRotating(true);
    const res = await fetch("/api/v1/form-monitor/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rotate-tracking" }),
    });
    if (res.ok) {
      const data = (await res.json()) as SettingsPayload;
      setSettings(data);
      navigator.clipboard.writeText(data.trackingWebhookUrl);
      toast.success("Tracking webhook rotated and copied");
      setRotateOpen(false);
    } else {
      toast.error("Failed to rotate tracking webhook");
    }
    setRotating(false);
  }

  async function saveMissingSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/v1/form-monitor/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save-missing",
        missingWebhookUrl: missingUrl,
        checkDelayMinutes: Number.parseInt(delayMinutes, 10),
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as SettingsPayload;
      setSettings(data);
      setMissingUrl(data.missingWebhookUrl ?? "");
      setDelayMinutes(String(data.checkDelayMinutes ?? 60));
      toast.success("Missing-tracking settings saved");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Failed to save settings");
    }
    setSaving(false);
  }

  async function saveTestParams(e: React.FormEvent) {
    e.preventDefault();
    setSavingTests(true);
    const res = await fetch("/api/v1/form-monitor/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save-test-params",
        testQueryParams: testParams,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as SettingsPayload;
      setSettings(data);
      setTestParams(data.testQueryParams ?? "");
      toast.success("Test parameters saved");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Failed to save test parameters");
    }
    setSavingTests(false);
  }

  async function saveTrend(e: React.FormEvent) {
    e.preventDefault();
    setSavingTrend(true);
    const res = await fetch("/api/v1/form-monitor/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save-trend",
        trendBandPercent: Number.parseInt(trendBand, 10),
        trendAbsDelta: Number.parseInt(trendAbs, 10),
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as SettingsPayload;
      setSettings(data);
      setTrendBand(String(data.trendBandPercent ?? 15));
      setTrendAbs(String(data.trendAbsDelta ?? 2));
      toast.success("Trend settings saved");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Failed to save trend settings");
    }
    setSavingTrend(false);
  }

  async function saveWhatConverts(e: React.FormEvent) {
    e.preventDefault();
    setSavingWhatConverts(true);
    const res = await fetch("/api/v1/form-monitor/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save-whatconverts",
        whatConvertsUrl,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as SettingsPayload;
      setSettings(data);
      setWhatConvertsUrl(data.whatConvertsUrl ?? "");
      toast.success("WhatConverts URL saved");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Failed to save WhatConverts URL");
    }
    setSavingWhatConverts(false);
  }

  return (
    <div className="space-y-6">
      {loading || !settings ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Inbound tracking webhook</CardTitle>
              <CardDescription>
                Paste this URL into WhatConverts (Web Forms). Events without{" "}
                <code>tacowp_reference_id</code> are ignored. Rotating this URL immediately invalidates
                the previous one.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Input value={settings.trackingWebhookUrl} readOnly />
                <Button variant="outline" onClick={copyTrackingUrl}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
              </div>
              <Button variant="destructive" onClick={() => setRotateOpen(true)}>
                Rotate URL
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>WhatConverts</CardTitle>
              <CardDescription>
                Custom domain for opening a lead in WhatConverts. Stored as the origin only, for example{" "}
                <code>https://app.example.com</code>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveWhatConverts} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="whatConvertsUrl">App URL</Label>
                  <Input
                    id="whatConvertsUrl"
                    value={whatConvertsUrl}
                    onChange={(event) => setWhatConvertsUrl(event.target.value)}
                    placeholder="https://app.whatconverts.com"
                  />
                </div>
                <Button type="submit" disabled={savingWhatConverts}>
                  {savingWhatConverts ? "Saving..." : "Save"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Missing tracking webhook</CardTitle>
              <CardDescription>
                Optional outbound URL. After the delay below, if tracking has not arrived, TacoWP POSTs a
                JSON payload here once (no personal data). Leave the URL blank to skip alerts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveMissingSettings} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="missingWebhookUrl">Destination URL</Label>
                  <Input
                    id="missingWebhookUrl"
                    value={missingUrl}
                    onChange={(event) => setMissingUrl(event.target.value)}
                    placeholder="https://hooks.example.com/form-monitor"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkDelayMinutes">Delay (minutes)</Label>
                  <Input
                    id="checkDelayMinutes"
                    type="number"
                    min={0}
                    step={1}
                    value={delayMinutes}
                    onChange={(event) => setDelayMinutes(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    How long to wait after a form submission before checking for tracking. Default 60 (1
                    hour).
                  </p>
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test parameters</CardTitle>
              <CardDescription>
                Comma-separated query parameter names. A submission is marked Test when its Gravity Forms
                source URL includes any of these names, for example <code>checkview_test_id</code>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveTestParams} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="testQueryParams">Parameter names</Label>
                  <Input
                    id="testQueryParams"
                    value={testParams}
                    onChange={(event) => setTestParams(event.target.value)}
                    placeholder="checkview_test_id"
                  />
                </div>
                <Button type="submit" disabled={savingTests}>
                  {savingTests ? "Saving..." : "Save"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trend</CardTitle>
              <CardDescription>
                Usual variation on the Form Monitor list. A site is flat inside the larger of ±N forms or
                ±N% of its 30-day pace. The arrow shows how far past that range the selected period is.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveTrend} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="trendBandPercent">Percent band</Label>
                  <Input
                    id="trendBandPercent"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={trendBand}
                    onChange={(event) => setTrendBand(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Default 15. Treated as normal volume swing.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trendAbsDelta">Form floor</Label>
                  <Input
                    id="trendAbsDelta"
                    type="number"
                    min={0}
                    step={1}
                    value={trendAbs}
                    onChange={(event) => setTrendAbs(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Default 2. Low-volume sites stay flat unless they move by at least this many forms.
                  </p>
                </div>
                <Button type="submit" disabled={savingTrend}>
                  {savingTrend ? "Saving..." : "Save"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate tracking webhook?</DialogTitle>
            <DialogDescription>
              The current WhatConverts URL will stop working until you paste the new one.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRotateOpen(false)} disabled={rotating}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={rotateTracking} disabled={rotating}>
              {rotating ? "Rotating..." : "Rotate and copy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}