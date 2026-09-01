import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeCommand } from "@/lib/commands";

export async function GET(
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

  const commands = await prisma.command.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ commands: commands.map(serializeCommand) });
}
