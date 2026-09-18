import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listOverview } from "@/Feature/FormMonitor/queries";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const overview = await listOverview();
  return NextResponse.json(overview);
}