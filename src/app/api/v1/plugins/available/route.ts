import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getLatestRelease } from "@/lib/github";
import { validateLicense } from "@/lib/license";
import { getServerOrigin } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const licenseKey = searchParams.get("license_key");
  const siteUrl = searchParams.get("site_url");

  if (!licenseKey || !siteUrl) {
    return NextResponse.json(
      { error: "Missing required parameters: license_key, site_url" },
      { status: 400 }
    );
  }

  const license = await validateLicense(licenseKey, siteUrl);
  if (!license) {
    return NextResponse.json({ error: "Invalid or inactive license" }, { status: 403 });
  }

  const plugins = await prisma.plugin.findMany({
    where: license.pluginId ? { id: license.pluginId } : undefined,
    orderBy: { name: "asc" },
  });

  const serverUrl = getServerOrigin(req);
  const hasGithubAppConfig = Boolean(
    process.env.GITHUB_APP_ID &&
      process.env.GITHUB_APP_PRIVATE_KEY &&
      process.env.GITHUB_APP_INSTALLATION_ID
  );

  const availablePlugins = await Promise.all(
    plugins.map(async (plugin) => {
      const base = {
        slug: plugin.slug,
        name: plugin.name,
        description: plugin.description,
        installable: false,
        version: null as string | null,
        changelog: null as string | null,
        package: null as string | null,
      };

      if (!hasGithubAppConfig) return base;

      try {
        const release = await getLatestRelease(plugin.githubOwner, plugin.githubRepo, plugin.slug);
        if (!release) return base;

        return {
          ...base,
          installable: true,
          version: release.version,
          changelog: release.changelog,
          package: `${serverUrl}/api/v1/download/${plugin.slug}/${release.version}?license_key=${encodeURIComponent(licenseKey)}&site_url=${encodeURIComponent(siteUrl)}`,
        };
      } catch {
        return base;
      }
    })
  );

  return NextResponse.json({
    plugins: availablePlugins,
    github_configured: hasGithubAppConfig,
  });
}
