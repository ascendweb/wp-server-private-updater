import { NextRequest, NextResponse } from "next/server";
import { validateLicense, ensureSite } from "@/lib/license";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { license_key, site_url, site_token } = body;

  if (!license_key || !site_url || !site_token) {
    return NextResponse.json(
      { error: "Missing required fields: license_key, site_url, site_token" },
      { status: 400 }
    );
  }

  const license = await validateLicense(license_key, site_url);
  if (!license) {
    return NextResponse.json(
      { error: "Invalid or inactive license" },
      { status: 403 }
    );
  }

  const site = await ensureSite(site_url, license.id);

  if (site.siteToken) {
    return NextResponse.json({
      success: true,
      site_token: site.siteToken,
      message: "Token already established, use this one.",
    });
  }

  await prisma.site.update({
    where: { id: site.id },
    data: { siteToken: site_token },
  });

  return NextResponse.json({
    success: true,
    site_token: site_token,
    message: "Token registered.",
  });
}
