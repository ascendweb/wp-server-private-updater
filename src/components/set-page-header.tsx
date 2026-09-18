"use client";

import { usePageHeader, type HeaderCrumb } from "./page-header";

export function SetPageHeader({
  title,
  crumbs,
  backHref,
}: {
  title: string;
  crumbs?: HeaderCrumb[];
  backHref?: string;
}) {
  usePageHeader(title, undefined, { crumbs, backHref });
  return null;
}
