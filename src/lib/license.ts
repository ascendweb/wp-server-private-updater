import { prisma } from "./db";
import type { Site } from "@prisma/client";
import { siteUrlsMatch } from "./site-url";

export async function validateLicense(
  licenseKey: string,
  siteUrl: string
) {
  const license = await prisma.license.findUnique({
    where: { key: licenseKey },
    include: { site: true },
  });

  if (!license || license.status !== "active") {
    return null;
  }

  const urlMatches =
    siteUrlsMatch(license.siteUrl, siteUrl) ||
    Boolean(license.site && siteUrlsMatch(license.site.url, siteUrl));

  if (!urlMatches) {
    return null;
  }

  const shouldUpdateCheckin =
    !license.lastCheckAt || Date.now() - license.lastCheckAt.getTime() > 15 * 60 * 1000;

  if (shouldUpdateCheckin) {
    await prisma.license.update({
      where: { id: license.id },
      data: { lastCheckAt: new Date() },
    });
  }

  return license;
}

export async function ensureSite(siteUrl: string, licenseId?: string): Promise<Site> {
  const normalizedUrl = normalizeSiteUrl(siteUrl);
  let site = await findSiteByEquivalentUrl(siteUrl, normalizedUrl);

  if (!site) {
    site = await prisma.site.create({
      data: {
        url: normalizedUrl,
        label: normalizedUrl,
      },
    });
  }

  if (licenseId) {
    await prisma.license.updateMany({
      where: {
        id: licenseId,
        OR: [{ siteId: null }, { siteId: { not: site.id } }],
      },
      data: { siteId: site.id },
    });
  }

  return site;
}

async function findSiteByEquivalentUrl(siteUrl: string, normalizedUrl: string): Promise<Site | null> {
  const exact = await prisma.site.findUnique({ where: { url: normalizedUrl } });
  if (exact) {
    return exact;
  }

  const sites = await prisma.site.findMany();
  return sites.find((candidate) => siteUrlsMatch(candidate.url, siteUrl)) ?? null;
}

export async function ensureSiteToken(siteId: string): Promise<string> {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
  if (site.siteToken) return site.siteToken;

  const token = crypto.randomUUID();
  await prisma.site.update({
    where: { id: siteId },
    data: { siteToken: token },
  });
  return token;
}

export function normalizeSiteUrl(url: string): string {
  const raw = url.trim();
  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return `${parsed.protocol}//${parsed.host}`.toLowerCase();
  } catch {
    return raw.toLowerCase().replace(/\/+$/, "");
  }
}
