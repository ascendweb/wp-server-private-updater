import { prisma } from "@/lib/db";
import { PluginsClient } from "./plugins-client";

export default async function PluginsPage() {
  const plugins = await prisma.plugin.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { licenses: true } } },
  });

  return <PluginsClient initialPlugins={plugins} />;
}
