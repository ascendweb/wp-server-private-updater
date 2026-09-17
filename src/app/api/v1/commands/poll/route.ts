import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeClaimedCommand, expireStaleCommands } from "@/lib/commands";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { site_token, command_id } = body as { site_token?: string; command_id?: string };

  if (!site_token) {
    return NextResponse.json(
      { error: "Missing required field: site_token" },
      { status: 400 }
    );
  }

  const site = await prisma.site.findFirst({
    where: { siteToken: site_token },
    include: {
      licenses: { where: { status: "active" }, take: 1, select: { key: true } },
    },
  });

  if (!site) {
    return NextResponse.json({ error: "Invalid site token" }, { status: 403 });
  }

  await expireStaleCommands();

  const licenseKey = site.licenses[0]?.key ?? null;
  const commandId = typeof command_id === "string" ? command_id.trim() : "";

  if (commandId) {
    const claimed = await prisma.command.updateMany({
      where: { id: commandId, siteId: site.id, status: "pending" },
      data: { status: "delivered", deliveredAt: new Date() },
    });
    if (claimed.count === 0) {
      return NextResponse.json({ commands: [] });
    }
    const command = await prisma.command.findFirst({
      where: { id: commandId, siteId: site.id },
    });
    if (!command) {
      return NextResponse.json({ commands: [] });
    }
    return NextResponse.json({
      commands: [await serializeClaimedCommand(command, site, licenseKey)],
    });
  }

  const commands = await prisma.command.findMany({
    where: {
      siteId: site.id,
      status: "pending",
      schedule: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (commands.length > 0) {
    await prisma.command.updateMany({
      where: {
        id: { in: commands.map((command) => command.id) },
        status: "pending",
      },
      data: {
        status: "delivered",
        deliveredAt: new Date(),
      },
    });
  }

  return NextResponse.json({
    commands: await Promise.all(
      commands.map((command) => serializeClaimedCommand(command, site, licenseKey))
    ),
  });
}
