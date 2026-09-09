import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPluginLatestRelease } from "@/lib/plugin-release";

export async function GET(
  req: NextRequest,
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

  try {
    const release = await getPluginLatestRelease(plugin, {
      refresh: req.nextUrl.searchParams.get("refresh") === "1",
    });
    if (!release) {
      return NextResponse.json({ error: "No releases found" }, { status: 404 });
    }

    return NextResponse.json(release);
  } catch {
    return NextResponse.json({ error: "Failed to fetch latest release" }, { status: 502 });
  }
}
