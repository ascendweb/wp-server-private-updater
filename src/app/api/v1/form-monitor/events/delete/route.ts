import { NextRequest, NextResponse } from "next/server";
import { validateLicense, ensureSite } from "@/lib/license";
import { recordDeletedEntry } from "@/Feature/FormMonitor/matching";
import { parseOptionalInt } from "@/Feature/FormMonitor/protocol";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { license_key, site_url, entry_id } = body as {
    license_key?: string;
    site_url?: string;
    entry_id?: unknown;
  };
  const entryId = parseOptionalInt(entry_id);

  if (!license_key || !site_url || entryId === null) {
    return NextResponse.json(
      { error: "Missing required fields: license_key, site_url, entry_id" },
      { status: 400 }
    );
  }

  const license = await validateLicense(license_key, site_url);
  if (!license) {
    return NextResponse.json({ error: "Invalid or inactive license" }, { status: 403 });
  }

  const site = await ensureSite(site_url, license.id);
  await recordDeletedEntry({ siteId: site.id, entryId });
  return NextResponse.json({ success: true });
}
