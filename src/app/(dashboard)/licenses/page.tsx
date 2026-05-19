import { prisma } from "@/lib/db";
import { LicensesClient } from "./licenses-client";

export default async function LicensesPage() {
  const [licenses, plugins] = await Promise.all([
    prisma.license.findMany({
      orderBy: { createdAt: "desc" },
      include: { plugin: { select: { id: true, slug: true, name: true } } },
    }),
    prisma.plugin.findMany({
      orderBy: { name: "asc" },
      select: { id: true, slug: true, name: true },
    }),
  ]);

  return <LicensesClient initialLicenses={licenses} plugins={plugins} />;
}
