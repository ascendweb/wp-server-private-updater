import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLatestRelease } from "@/lib/github";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const plugin = await prisma.plugin.findUnique({ where: { slug } });

  if (!plugin) {
    return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
  }

  const release = await getLatestRelease(plugin.githubOwner, plugin.githubRepo, slug);
  if (!release) {
    return NextResponse.json({ error: "No releases found" }, { status: 404 });
  }

  return NextResponse.json(release);
}
