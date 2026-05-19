import { NextRequest, NextResponse } from "next/server";
import { validateLicense } from "@/lib/license";
import { streamReleaseZip } from "@/lib/github";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; version: string }> }
) {
  const { slug, version } = await params;
  const licenseKey = req.nextUrl.searchParams.get("license_key");
  const siteUrl = req.nextUrl.searchParams.get("site_url");

  if (!licenseKey || !siteUrl) {
    return NextResponse.json({ error: "Missing license_key or site_url" }, { status: 400 });
  }

  const license = await validateLicense(licenseKey, siteUrl, slug);
  if (!license) {
    return NextResponse.json({ error: "Invalid or inactive license" }, { status: 403 });
  }

  const plugin = await prisma.plugin.findUnique({ where: { slug } });
  if (!plugin) {
    return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
  }

  const result = await streamReleaseZip(plugin.githubOwner, plugin.githubRepo, version);
  if (!result) {
    return NextResponse.json({ error: "Release zip not found" }, { status: 404 });
  }

  return new Response(result.stream, {
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${slug}-${version}.zip"`,
    },
  });
}
