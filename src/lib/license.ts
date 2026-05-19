import { prisma } from "./db";

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
    include: { plugin: true },
  });

  if (!license) return null;

  if (pluginSlug && license.pluginId && license.plugin?.slug !== pluginSlug) {
    return null;
  }

  await prisma.license.update({
    where: { id: license.id },
    data: { lastCheckAt: new Date() },
  });

  return license;
}

export function normalizeSiteUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`.toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/+$/, "");
  }
}
