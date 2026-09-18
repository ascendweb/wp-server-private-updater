import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listSiteSummaries } from "@/Feature/FormMonitor/queries";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sites = await listSiteSummaries();
  return NextResponse.json(sites);
}