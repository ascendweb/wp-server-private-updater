import { NextRequest, NextResponse } from "next/server";
import { validateLicense } from "@/lib/license";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const licenseKey = searchParams.get("license_key");
  const siteUrl = searchParams.get("site_url");

  if (!licenseKey || !siteUrl) {
    return NextResponse.json(
      { valid: false, reason: "Missing required parameters: license_key, site_url" },
      { status: 400 }
    );
  }

  const license = await validateLicense(licenseKey, siteUrl);

  if (!license) {
    return NextResponse.json({ valid: false, reason: "License not found or inactive" });
  }

  return NextResponse.json({
    valid: true,
    license: {
      status: license.status,
    },
  });
}
