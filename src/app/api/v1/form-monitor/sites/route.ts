import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listOverview } from "@/Feature/FormMonitor/queries";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const overview = await listOverview({
    range: req.nextUrl.searchParams.get("range"),
    since: req.nextUrl.searchParams.get("since"),
    until: req.nextUrl.searchParams.get("until"),
  });
  return NextResponse.json(overview);
}
