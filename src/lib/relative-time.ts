const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "always" });

export function formatRelativeTime(value: Date | string | number): string {
  const date = new Date(value);
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);

  if (abs < 60) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(diffSec / 86400), "day");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / (86400 * 7)), "week");
  if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), "month");
  return rtf.format(Math.round(diffSec / (86400 * 365)), "year");
}
