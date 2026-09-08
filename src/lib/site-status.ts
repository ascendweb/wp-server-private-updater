import type { Prisma } from "@prisma/client";

export const SITE_STATUS_ACTIVE = "active";
export const SITE_STATUS_ARCHIVED = "archived";

export function isSiteArchived(site: { status: string } | null | undefined): boolean {
  return site?.status === SITE_STATUS_ARCHIVED;
}

/** Licenses whose linked site is archived should be hidden from active lists. */
export const excludeArchivedSiteLicenses: Prisma.LicenseWhereInput = {
  NOT: { site: { status: SITE_STATUS_ARCHIVED } },
};

export const activeSiteWhere: Prisma.SiteWhereInput = { status: SITE_STATUS_ACTIVE };
export const archivedSiteWhere: Prisma.SiteWhereInput = { status: SITE_STATUS_ARCHIVED };
