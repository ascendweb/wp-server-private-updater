import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSiteChart } from "@/Feature/FormMonitor/queries";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { siteId } = await params;
  const data = await getSiteChart(siteId, {
    range: req.nextUrl.searchParams.get("range"),
    since: req.nextUrl.searchParams.get("since"),
    until: req.nextUrl.searchParams.get("until"),
  });
  if (!data) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
