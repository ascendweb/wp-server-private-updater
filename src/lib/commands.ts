import { prisma } from "./db";
import type { CommandType, Command } from "@prisma/client";

export async function createCommand(
  siteId: string,
  type: CommandType,
  pluginSlug: string,
  targetVersion?: string | null,
  packageUrl?: string | null
): Promise<Command> {
  return prisma.command.create({
    data: {
      siteId,
      type,
      pluginSlug,
      targetVersion: targetVersion ?? null,
      packageUrl: packageUrl ?? null,
      status: "pending",
    },
  });
}

function pingCandidateUrls(siteUrl: string, siteToken: string): string[] {
  const base = siteUrl.replace(/\/+$/, "");
  const token = encodeURIComponent(siteToken);
  return [
    `${base}/wp-json/wppu/v1/ping?token=${token}`,
    `${base}/index.php?rest_route=/wppu/v1/ping&token=${token}`,
    `${base}/?wppu_ping=1&token=${token}`,
  ];
}

/**
 * Send a lightweight GET ping to the site to trigger it to poll for commands.
 * Prefers the REST route (usually excluded from page caches), then falls back
 * to the homepage query-arg ping for older plugin versions. The site verifies
 * the site token and calls back to fetch pending commands via POST /api/v1/commands/poll.
 */
async function pingSite(siteUrl: string, siteToken: string): Promise<boolean> {
  for (const pingUrl of pingCandidateUrls(siteUrl, siteToken)) {
    try {
      const response = await fetch(pingUrl, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(90_000),
      });
      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          return true;
        }
      }
    } catch {
      // Try the next candidate URL.
    }
  }
  return false;
}

/**
 * Create a command and attempt to ping the site to process it immediately.
 * If the ping fails, the command stays pending for the site's next check-in.
 */
export async function createAndDispatch(
  siteId: string,
  type: CommandType,
  pluginSlug: string,
  targetVersion?: string | null,
  packageUrl?: string | null
): Promise<Command> {
  const command = await createCommand(siteId, type, pluginSlug, targetVersion, packageUrl);

  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });

  if (site.siteToken) {
    await pingSite(site.url, site.siteToken);
  }

  return prisma.command.findUniqueOrThrow({ where: { id: command.id } });
}
