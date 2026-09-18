"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatRelativeTime } from "@/lib/relative-time";

export function RelativeTime({ value }: { value: string | Date | null }) {
  if (!value) return <span>—</span>;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <span>—</span>;

  return (
    <Tooltip>
      <TooltipTrigger
        render={<time dateTime={date.toISOString()}>{formatRelativeTime(date)}</time>}
      />
      <TooltipContent>{date.toLocaleString()}</TooltipContent>
    </Tooltip>
  );
}
