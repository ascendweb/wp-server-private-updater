import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { site_token } = body;

  if (!site_token) {
    return NextResponse.json(
      { error: "Missing required field: site_token" },
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

  const commands = await prisma.command.findMany({
    where: {
      siteId: site.id,
      status: "pending",
    },
    orderBy: { createdAt: "asc" },
  });

  if (commands.length > 0) {
    await prisma.command.updateMany({
      where: {
        id: { in: commands.map((c) => c.id) },
        status: "pending",
      },
      data: {
        status: "delivered",
        deliveredAt: new Date(),
      },
    });
  }

  return NextResponse.json({
    commands: commands.map((c) => ({
      id: c.id,
      type: c.type,
      plugin_slug: c.pluginSlug,
      target_version: c.targetVersion,
      package_url: c.packageUrl,
    })),
  });
}
