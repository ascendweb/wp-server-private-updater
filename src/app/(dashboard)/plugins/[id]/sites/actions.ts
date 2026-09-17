"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAndDispatch } from "@/lib/commands";
import { activeSiteWhere } from "@/lib/site-status";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

export async function forceUpdateSite(siteId: string, pluginSlug: string) {
  await requireAuth();

  const plugin = await prisma.plugin.findUnique({ where: { slug: pluginSlug } });
  if (!plugin) throw new Error("Plugin not found");

  return createAndDispatch(siteId, "update", pluginSlug);
}

export async function forceUpdateAll(pluginSlug: string) {
  await requireAuth();

  const sitePlugins = await prisma.sitePlugin.findMany({
    where: {
      pluginSlug,
      isLocked: false,
      site: activeSiteWhere,
    },
    select: { siteId: true },
  });

  const plugin = await prisma.plugin.findUnique({ where: { slug: pluginSlug } });
  if (!plugin) throw new Error("Plugin not found");

  let dispatched = 0;
  for (const sp of sitePlugins) {
    await createAndDispatch(sp.siteId, "update", pluginSlug);
    dispatched++;
  }

  return { dispatched };
}
