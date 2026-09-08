import { prisma } from "@/lib/db";
import { PluginsClient } from "./plugins-client";
import { activeSiteWhere } from "@/lib/site-status";

export default async function PluginsPage() {
  const plugins = await prisma.plugin.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { sitePlugins: { where: { site: activeSiteWhere } } } },
    },
  });

  return <PluginsClient initialPlugins={plugins} />;
}
