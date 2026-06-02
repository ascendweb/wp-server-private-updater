"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAndDispatch } from "@/lib/commands";
import { getLatestRelease } from "@/lib/github";
import { getServerOriginFromEnv } from "@/lib/utils";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

export async function forceUpdateSite(
  siteId: string,
  pluginSlug: string
) {
  await requireAuth();

  const plugin = await prisma.plugin.findUnique({ where: { slug: pluginSlug } });
  if (!plugin) throw new Error("Plugin not found");

  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
  const license = await prisma.license.findFirst({
    where: { siteId: site.id, status: "active" },
  });

  let packageUrl: string | null = null;
  if (license) {
    const release = await getLatestRelease(plugin.githubOwner, plugin.githubRepo, plugin.slug);
    if (release) {
      const serverUrl = getServerOriginFromEnv();
      packageUrl = `${serverUrl}/api/v1/download/${pluginSlug}/${release.version}?license_key=${encodeURIComponent(license.key)}&site_url=${encodeURIComponent(site.url)}`;
    }
  }

  return createAndDispatch(siteId, "update", pluginSlug, null, packageUrl);
}

export async function forceUpdateAll(pluginSlug: string) {
  await requireAuth();

  const sitePlugins = await prisma.sitePlugin.findMany({
    where: {
      pluginSlug,
      isLocked: false,
    },
    include: {
      site: {
        include: {
          licenses: {
            where: { status: "active" },
            take: 1,
          },
        },
      },
    },
  });

  const plugin = await prisma.plugin.findUnique({ where: { slug: pluginSlug } });
  if (!plugin) throw new Error("Plugin not found");

  const release = await getLatestRelease(plugin.githubOwner, plugin.githubRepo, plugin.slug);
  const serverUrl = getServerOriginFromEnv();

  let dispatched = 0;
  for (const sp of sitePlugins) {
    const license = sp.site.licenses[0];
    let packageUrl: string | null = null;
    if (license && release) {
      packageUrl = `${serverUrl}/api/v1/download/${pluginSlug}/${release.version}?license_key=${encodeURIComponent(license.key)}&site_url=${encodeURIComponent(sp.site.url)}`;
    }

    await createAndDispatch(sp.siteId, "update", pluginSlug, null, packageUrl);
    dispatched++;
  }

  return { dispatched };
}
