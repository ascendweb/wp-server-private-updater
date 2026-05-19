import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeSiteUrl } from "@/lib/license";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const licenses = await prisma.license.findMany({
    orderBy: { createdAt: "desc" },
    include: { plugin: { select: { slug: true, name: true } } },
  });

  return NextResponse.json(licenses);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { siteUrl, pluginId, label } = body;

  if (!siteUrl) {
    return NextResponse.json({ error: "Missing siteUrl" }, { status: 400 });
  }

  const license = await prisma.license.create({
    data: {
      siteUrl: normalizeSiteUrl(siteUrl),
      pluginId: pluginId || null,
      label: label || null,
      status: "active",
    },
    include: { plugin: { select: { slug: true, name: true } } },
  });

  return NextResponse.json(license, { status: 201 });
}
