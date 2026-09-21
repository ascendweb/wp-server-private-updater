import { NextRequest, NextResponse } from "next/server";
import { validateLicense, ensureSite } from "@/lib/license";
import { recordFormEvent } from "@/Feature/FormMonitor/matching";
import { parseOptionalInt, parseSubmittedAt } from "@/Feature/FormMonitor/protocol";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { license_key, site_url, reference_id, submitted_at, form_id, entry_id, form_title, spam } = body as {
    license_key?: string;
    site_url?: string;
    reference_id?: string;
    submitted_at?: unknown;
    form_id?: unknown;
    entry_id?: unknown;
    form_title?: unknown;
    spam?: unknown;
  };

  if (!license_key || !site_url || !reference_id) {
    return NextResponse.json(
      { error: "Missing required fields: license_key, site_url, reference_id" },
      { status: 400 }
    );
  }

  const license = await validateLicense(license_key, site_url);
  if (!license) {
    return NextResponse.json({ error: "Invalid or inactive license" }, { status: 403 });
  }

  const site = await ensureSite(site_url, license.id);
  await recordFormEvent({
    siteId: site.id,
    referenceId: String(reference_id).trim(),
    formId: parseOptionalInt(form_id),
    entryId: parseOptionalInt(entry_id),
    formTitle: typeof form_title === "string" && form_title.trim() ? form_title.trim() : null,
    submittedAt: parseSubmittedAt(submitted_at),
    spam: spam === true,
  });

  return NextResponse.json({ success: true });
}