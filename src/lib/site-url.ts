/**
 * Display and sort helpers for stored site URLs.
 *
 * Stored values stay as full URLs (protocol + host). Display drops the
 * protocol and a leading www. Other subdomains are kept, so
 * shop.example.com stays distinct from example.com.
 */

function extractHost(input: string): string {
  const raw = input.trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return parsed.host;
  } catch {
    return raw.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  }
}

function stripWww(host: string): string {
  return host.replace(/^www\./i, "");
}

/**
 * License/site identity: host without www, lowercased.
 * Ignores http vs https. Other subdomains stay distinct.
 */
export function canonicalSiteHost(url: string): string {
  return stripWww(extractHost(url)).toLowerCase();
}

export function siteUrlsMatch(a: string, b: string): boolean {
  const left = canonicalSiteHost(a);
  const right = canonicalSiteHost(b);
  return Boolean(left) && left === right;
}

export function formatSiteHost(url: string): string {
  return stripWww(extractHost(url));
}

export function formatSiteTitle(url: string, label?: string | null): string {
  const trimmed = label?.trim();
  if (trimmed && trimmed !== url && !/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return formatSiteHost(url);
}

export function compareSiteUrls(a: string, b: string): number {
  return formatSiteHost(a).localeCompare(formatSiteHost(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function sortBySiteUrl<T>(items: readonly T[], url: (item: T) => string): T[] {
  return [...items].sort((a, b) => compareSiteUrls(url(a), url(b)));
}
