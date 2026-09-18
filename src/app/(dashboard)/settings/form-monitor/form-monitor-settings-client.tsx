"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
};

export function FormMonitorSettingsClient() {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [missingUrl, setMissingUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotating, setRotating] = useState(false);

  usePageHeader("Form Monitor settings");

  async function load() {
    const res = await fetch("/api/v1/form-monitor/settings");
    if (res.ok) {
      const data = (await res.json()) as SettingsPayload;
      setSettings(data);
      setMissingUrl(data.missingWebhookUrl ?? "");
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

  async function saveMissingUrl(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/v1/form-monitor/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save-missing-url", missingWebhookUrl: missingUrl }),
    });
    if (res.ok) {
      const data = (await res.json()) as SettingsPayload;
      setSettings(data);
      setMissingUrl(data.missingWebhookUrl ?? "");
      toast.success("Missing-tracking webhook saved");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Failed to save webhook URL");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <Link href="/form-monitor" className="text-sm text-muted-foreground hover:underline">
        ← Back to Form Monitor
      </Link>

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
              <CardTitle>Missing tracking webhook</CardTitle>
              <CardDescription>
                Optional outbound URL. One hour after a form event, if tracking has not arrived, TacoWP
                POSTs a JSON payload here once (no personal data). Leave blank to skip alerts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveMissingUrl} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="missingWebhookUrl">Destination URL</Label>
                  <Input
                    id="missingWebhookUrl"
                    value={missingUrl}
                    onChange={(event) => setMissingUrl(event.target.value)}
                    placeholder="https://hooks.example.com/form-monitor"
                  />
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save"}
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