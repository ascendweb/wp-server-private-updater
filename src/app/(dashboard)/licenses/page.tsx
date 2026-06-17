import { prisma } from "@/lib/db";
import { LicensesClient } from "./licenses-client";

export default async function LicensesPage() {
  const licenses = await prisma.license.findMany({
    orderBy: { createdAt: "desc" },
  });

  return <LicensesClient initialLicenses={licenses} />;
}
