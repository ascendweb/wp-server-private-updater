import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plugins = await prisma.plugin.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { licenses: true } } },
  });

  return NextResponse.json(plugins);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { slug, name, description, githubOwner, githubRepo, testedWp, requiresPhp } = body;

  if (!slug || !name || !githubOwner || !githubRepo) {
    return NextResponse.json(
      { error: "Missing required fields: slug, name, githubOwner, githubRepo" },
      { status: 400 }
    );
  }

  try {
    const plugin = await prisma.plugin.create({
      data: { slug, name, description, githubOwner, githubRepo, testedWp, requiresPhp },
    });
    return NextResponse.json(plugin, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Plugin with this slug or repo already exists" },
      { status: 409 }
    );
  }
}
