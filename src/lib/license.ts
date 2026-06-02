import { prisma } from "./db";
import type { Site } from "@prisma/client";

export async function validateLicense(
  licenseKey: string,
  siteUrl: string,
  pluginSlug?: string
) {
  const normalizedUrl = normalizeSiteUrl(siteUrl);

  const license = await prisma.license.findFirst({
    where: {
      key: licenseKey,
      status: "active",
      siteUrl: normalizedUrl,
    },
    include: { plugin: true, site: true },
  });

  if (!license) return null;

  if (pluginSlug && license.pluginId && license.plugin?.slug !== pluginSlug) {
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

/**
 * Find or create a Site record for the given URL, and ensure the license
 * is linked to it. Returns the Site.
 */
export async function ensureSite(siteUrl: string, licenseId?: string): Promise<Site> {
  const normalizedUrl = normalizeSiteUrl(siteUrl);
  const pushUrl = normalizedUrl + "/wp-json/wppu/v1";

  const site = await prisma.site.upsert({
    where: { url: normalizedUrl },
    create: {
      url: normalizedUrl,
      label: normalizedUrl,
      pushUrl,
    },
    update: {},
  });

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

/**
 * Ensure the site has a siteToken. Generates one if missing, returns it.
 */
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
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`.toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/+$/, "");
  }
}
