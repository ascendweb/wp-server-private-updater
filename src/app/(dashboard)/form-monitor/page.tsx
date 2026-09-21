import { Suspense } from "react";
import type { Metadata } from "next";
import { FormMonitorListClient } from "./form-monitor-list-client";

export const metadata: Metadata = { title: "Form Monitor" };

export default function FormMonitorPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading...</p>}>
      <FormMonitorListClient />
    </Suspense>
  );
}
