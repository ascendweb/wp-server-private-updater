import type { Metadata } from "next";
import { FormMonitorSettingsClient } from "./form-monitor-settings-client";

export const metadata: Metadata = { title: "Form Monitor settings" };

export default function FormMonitorSettingsPage() {
  return <FormMonitorSettingsClient />;
}