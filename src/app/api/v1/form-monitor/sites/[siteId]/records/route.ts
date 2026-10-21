import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listSiteRecords } from "@/Feature/FormMonitor/queries";
import { resolveFormMonitorRange, resolveFormMonitorSeries } from "@/Feature/FormMonitor/range";

export async function GET(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { siteId } = await params;
  const range = resolveFormMonitorRange({
    range: req.nextUrl.searchParams.get("range"),
    since: req.nextUrl.searchParams.get("since"),
    until: req.nextUrl.searchParams.get("until"),
  });
  const data = await listSiteRecords({
    siteId,
    series: resolveFormMonitorSeries(req.nextUrl.searchParams.get("series")),
    since: range.since,
    until: range.until,
    cursor: req.nextUrl.searchParams.get("cursor"),
  });
  return NextResponse.json(data);
}
