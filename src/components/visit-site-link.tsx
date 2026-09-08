"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { formatSiteHost } from "@/lib/site-url";

export function VisitSiteLink({ url }: { url: string }) {
  const href = url.includes("://") ? url : `https://${url}`;

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Visit ${formatSiteHost(url)}`}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-blue-500 hover:bg-neutral-200"
      onClick={(e) => e.stopPropagation()}
    >
      <ExternalLink className="h-3 w-3" />
    </Link>
  );
}
