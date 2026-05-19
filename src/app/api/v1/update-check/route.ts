import { NextRequest, NextResponse } from "next/server";
import { validateLicense } from "@/lib/license";
import { getLatestRelease } from "@/lib/github";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const slug = searchParams.get("slug");
  const version = searchParams.get("version");
  const licenseKey = searchParams.get("license_key");
  const siteUrl = searchParams.get("site_url");

  if (!slug || !version || !licenseKey || !siteUrl) {
    return NextResponse.json(
      { error: "Missing required parameters: slug, version, license_key, site_url" },
      { status: 400 }
    );
  }

  const license = await validateLicense(licenseKey, siteUrl, slug);
  if (!license) {
    return NextResponse.json({ error: "Invalid or inactive license" }, { status: 403 });
  }

  const plugin = await prisma.plugin.findUnique({ where: { slug } });
  if (!plugin) {
    return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
  }

  const release = await getLatestRelease(plugin.githubOwner, plugin.githubRepo, slug);
  if (!release) {
    return NextResponse.json({ error: "No releases found" }, { status: 404 });
  }

  if (!isNewerVersion(release.version, version)) {
    return NextResponse.json({ update: false, version: release.version });
  }

  const serverUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin;

  return NextResponse.json({
    slug: plugin.slug,
    new_version: release.version,
    package: `${serverUrl}/api/v1/download/${plugin.slug}/${release.version}?license_key=${licenseKey}&site_url=${encodeURIComponent(siteUrl)}`,
    tested: plugin.testedWp || "6.7",
    requires_php: plugin.requiresPhp || "8.0",
    sections: {
      changelog: release.changelog,
    },
  });
}

function isNewerVersion(latest: string, current: string): boolean {
  const l = latest.split(".").map(Number);
  const c = current.split(".").map(Number);
  const len = Math.max(l.length, c.length);
  for (let i = 0; i < len; i++) {
    const a = l[i] || 0;
    const b = c[i] || 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}
