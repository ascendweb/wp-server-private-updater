import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSiteChart } from "@/Feature/FormMonitor/queries";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { siteId } = await params;
  const data = await getSiteChart(siteId);
  if (!data) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}