import { prisma } from "@/lib/db";
import { LicensesClient } from "./licenses-client";
import { excludeArchivedSiteLicenses } from "@/lib/site-status";

export default async function LicensesPage() {
  const licenses = await prisma.license.findMany({
    where: excludeArchivedSiteLicenses,
    orderBy: { createdAt: "desc" },
  });

  return <LicensesClient initialLicenses={licenses} />;
}
