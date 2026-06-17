import { prisma } from "./db";
import type { Site } from "@prisma/client";

export async function validateLicense(
  licenseKey: string,
  siteUrl: string
) {
  const normalizedUrl = normalizeSiteUrl(siteUrl);

  const license = await prisma.license.findFirst({
    where: {
      key: licenseKey,
      status: "active",
      siteUrl: normalizedUrl,
    },
    include: { site: true },
  });

  if (!license) return null;

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

  const site = await prisma.site.upsert({
    where: { url: normalizedUrl },
    create: {
      url: normalizedUrl,
      label: normalizedUrl,
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
