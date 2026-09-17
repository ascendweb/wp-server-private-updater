import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { site_token, status } = body;

  if (!site_token) {
    return NextResponse.json(
      { error: "Missing required field: site_token" },
      { status: 400 }
    );
  }

  if (status !== "in_progress") {
    return NextResponse.json(
      { error: "Only 'in_progress' status transitions are allowed via this endpoint" },
      { status: 400 }
    );
  }

  const site = await prisma.site.findFirst({
    where: { siteToken: site_token },
  });

  if (!site) {
    return NextResponse.json(
      { error: "Invalid site token" },
      { status: 403 }
    );
  }

  const updated = await prisma.command.updateMany({
    where: { id, siteId: site.id, status: { in: ["pending", "delivered"] } },
    data: { status: "in_progress" },
  });

  if (updated.count === 0) {
    const existing = await prisma.command.findFirst({
      where: { id, siteId: site.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Command not found" }, { status: 404 });
    }
  }

  return NextResponse.json({ success: true });
}
