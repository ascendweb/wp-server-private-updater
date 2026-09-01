"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAndDispatch, serializeCommand } from "@/lib/commands";
import { getLatestRelease } from "@/lib/github";
import { getServerOriginFromEnv } from "@/lib/utils";
import type { CommandType } from "@prisma/client";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

const DISPATCH_TYPES = new Set<CommandType>(["update", "activate", "deactivate"]);

export async function dispatchPluginCommands(
  pluginId: string,
  siteIds: string[],
  type: CommandType
) {
  await requireAuth();

  if (!DISPATCH_TYPES.has(type)) {
    throw new Error("Unsupported command type");
  }
  if (siteIds.length === 0) {
    return { dispatched: 0, commands: [] };
  }

  const plugin = await prisma.plugin.findUnique({ where: { id: pluginId } });
  if (!plugin) throw new Error("Plugin not found");

  const sitePlugins = await prisma.sitePlugin.findMany({
    where: {
      pluginId: plugin.id,
      siteId: { in: siteIds },
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

  let releaseVersion: string | null = null;
  let packageBase: string | null = null;
  if (type === "update") {
    const release = await getLatestRelease(plugin.githubOwner, plugin.githubRepo, plugin.slug);
    if (release?.version) {
      releaseVersion = release.version;
      packageBase = `${getServerOriginFromEnv()}/api/v1/download/${plugin.slug}/${release.version}`;
    }
  }

  const commands = await Promise.all(
    sitePlugins.map(async (sp) => {
      const license = sp.site.licenses[0];
      let packageUrl: string | null = null;
      if (type === "update" && license && packageBase) {
        packageUrl = `${packageBase}?license_key=${encodeURIComponent(license.key)}&site_url=${encodeURIComponent(sp.site.url)}`;
      }

      const command = await createAndDispatch(
        sp.siteId,
        type,
        plugin.slug,
        type === "update" ? releaseVersion : null,
        packageUrl
      );
      return serializeCommand(command);
    })
  );

  return { dispatched: commands.length, commands };
}

export async function setSitesAutoSync(
  pluginId: string,
  siteIds: string[],
  autoSync: boolean
) {
  await requireAuth();

  if (siteIds.length === 0) {
    return { updated: 0 };
  }

  const result = await prisma.sitePlugin.updateMany({
    where: { pluginId, siteId: { in: siteIds } },
    data: { autoSync },
  });

  return { updated: result.count };
}
