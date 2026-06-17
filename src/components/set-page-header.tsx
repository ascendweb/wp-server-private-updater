"use client";

import { usePageHeader } from "./page-header";

export function SetPageHeader({ title }: { title: string }) {
  usePageHeader(title);
  return null;
}
