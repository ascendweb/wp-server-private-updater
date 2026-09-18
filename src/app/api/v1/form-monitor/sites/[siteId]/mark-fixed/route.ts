import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { markSiteMissingIgnored } from "@/Feature/FormMonitor/queries";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { siteId } = await params;
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true },
  });
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const count = await markSiteMissingIgnored(siteId);
  return NextResponse.json({ success: true, count });
}
