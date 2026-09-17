import { prisma } from "@/lib/db";
import { expireStaleCommands, serializeCommand } from "@/lib/commands";
import { findSiteByUrl } from "@/lib/license";
import { getPluginRollout } from "@/lib/plugin-rollout";
import { SITE_STATUS_ACTIVE, SITE_STATUS_ARCHIVED } from "@/lib/site-status";
import { sortBySiteUrl } from "@/lib/site-url";

export class McpQueryError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "bad_request" = "not_found"
  ) {
    super(message);
    this.name = "McpQueryError";
  }
}

function publicSite(site: {
  id: string;
  url: string;
  label: string | null;
  status: string;
  archivedAt: Date | null;
}) {
  return {
    id: site.id,
    url: site.url,
    label: site.label,
    status: site.status,
    archivedAt: site.archivedAt?.toISOString() ?? null,
  };
}

export async function resolveSite(ref: string) {
  const value = ref.trim();
  if (!value) {
    throw new McpQueryError("site is required", "bad_request");
  }

  const byId = await prisma.site.findUnique({
    where: { id: value },
    select: {
      id: true,
      url: true,
      label: true,
      status: true,
      archivedAt: true,
    },
  });
  if (byId) return byId;

  const byUrl = await findSiteByUrl(value);
  if (!byUrl) {
    throw new McpQueryError(`Site not found: ${value}`);
  }
  return {
    id: byUrl.id,
    url: byUrl.url,
    label: byUrl.label,
    status: byUrl.status,
    archivedAt: byUrl.archivedAt,
  };
}

export async function listSites(input: {
  query?: string;
  status?: "active" | "archived";
}) {
  const status = input.status === "archived" ? SITE_STATUS_ARCHIVED : SITE_STATUS_ACTIVE;
  const query = input.query?.trim().toLowerCase();

  const sites = await prisma.site.findMany({
    where: { status },
    include: {
      _count: { select: { plugins: true } },
      licenses: {
        where: { status: "active" },
        orderBy: { lastCheckAt: { sort: "desc", nulls: "last" } },
        take: 1,
        select: { lastCheckAt: true },
      },
    },
  });

  const filtered = query
    ? sites.filter((site) => {
        const hay = `${site.url} ${site.label ?? ""}`.toLowerCase();
        return hay.includes(query);
      })
    : sites;

  return {
    sites: sortBySiteUrl(filtered, (site) => site.url).map((site) => ({
      ...publicSite(site),
      pluginCount: site._count.plugins,
      lastCheckAt: site.licenses[0]?.lastCheckAt?.toISOString() ?? null,
    })),
  };
}

export async function getSite(siteRef: string) {
  const site = await resolveSite(siteRef);
  const [pluginCount, license] = await Promise.all([
    prisma.sitePlugin.count({ where: { siteId: site.id } }),
    prisma.license.findFirst({
      where: { siteId: site.id, status: "active" },
      orderBy: { lastCheckAt: { sort: "desc", nulls: "last" } },
      select: { lastCheckAt: true },
    }),
  ]);

  return {
    site: {
      ...publicSite(site),
      pluginCount,
      lastCheckAt: license?.lastCheckAt?.toISOString() ?? null,
    },
  };
}

export async function getSitePlugins(siteRef: string) {
  const site = await resolveSite(siteRef);
  const plugins = await prisma.sitePlugin.findMany({
    where: { siteId: site.id },
    include: {
      plugin: { select: { name: true, slug: true, latestVersion: true } },
    },
    orderBy: { pluginName: "asc" },
  });

  return {
    site: publicSite(site),
    plugins: plugins.map((sp) => ({
      slug: sp.pluginSlug,
      name: sp.plugin?.name || sp.pluginName || sp.pluginSlug,
      installedVersion: sp.installedVersion,
      isActive: sp.isActive,
      isLocked: sp.isLocked,
      pinnedVersion: sp.pinnedVersion,
      autoSync: sp.autoSync,
      isManaged: Boolean(sp.pluginId),
      latestVersion: sp.plugin?.latestVersion ?? null,
      lastReportedAt: sp.lastReportedAt.toISOString(),
    })),
  };
}

export async function getSiteCommands(siteRef: string) {
  const site = await resolveSite(siteRef);
  await expireStaleCommands();
  const commands = await prisma.command.findMany({
    where: { siteId: site.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return {
    site: publicSite(site),
    commands: commands.map(serializeCommand),
  };
}

export async function listCatalogPlugins() {
  const plugins = await prisma.plugin.findMany({
    orderBy: { name: "asc" },
    select: {
      slug: true,
      name: true,
      description: true,
      latestVersion: true,
      latestPublishedAt: true,
    },
  });

  return {
    plugins: plugins.map((plugin) => ({
      slug: plugin.slug,
      name: plugin.name,
      description: plugin.description,
      latestVersion: plugin.latestVersion,
      latestPublishedAt: plugin.latestPublishedAt?.toISOString() ?? null,
    })),
  };
}

export async function getPluginInstalls(pluginSlug: string) {
  const slug = pluginSlug.trim();
  if (!slug) {
    throw new McpQueryError("plugin is required", "bad_request");
  }

  const plugin = await prisma.plugin.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, latestVersion: true },
  });
  if (!plugin) {
    throw new McpQueryError(`Plugin not found: ${slug}`);
  }

  const rollout = await getPluginRollout(plugin.id);

  return {
    plugin: {
      slug: plugin.slug,
      name: plugin.name,
      latestVersion: plugin.latestVersion,
    },
    installs: (rollout?.sites ?? []).map((row) => ({
      siteId: row.siteId,
      url: row.siteUrl,
      label: row.siteLabel,
      installedVersion: row.installedVersion,
      pinnedVersion: row.pinnedVersion,
      autoSync: row.autoSync,
      isActive: row.isActive,
    })),
  };
}

export async function getCommand(commandId: string) {
  const id = commandId.trim();
  if (!id) {
    throw new McpQueryError("command_id is required", "bad_request");
  }

  await expireStaleCommands();
  const command = await prisma.command.findUnique({
    where: { id },
    include: {
      site: {
        select: { id: true, url: true, label: true, status: true, archivedAt: true },
      },
    },
  });
  if (!command) {
    throw new McpQueryError(`Command not found: ${id}`);
  }

  return {
    command: serializeCommand(command),
    site: publicSite(command.site),
  };
}
