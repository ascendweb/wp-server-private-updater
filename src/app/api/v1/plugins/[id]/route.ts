import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseGitHubRepoUrl } from "@/lib/github";
import { syncPluginLatestRelease } from "@/lib/plugin-release";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const plugin = await prisma.plugin.findUnique({
    where: { id },
  });

  if (!plugin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(plugin);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.plugin.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const updateData: {
    name?: string;
    description?: string | null;
    githubOwner?: string;
    githubRepo?: string;
    releaseAssetPattern?: string;
  } = {};

  if (typeof body.name === "string") {
    updateData.name = body.name;
  }
  if (body.description === null || typeof body.description === "string") {
    updateData.description = body.description;
  }
  if (body.githubUrl !== undefined) {
    const parsedRepo = parseGitHubRepoUrl(String(body.githubUrl));
    if (!parsedRepo) {
      return NextResponse.json(
        { error: "Invalid GitHub repository URL. Expected format: https://github.com/owner/repo" },
        { status: 400 }
      );
    }
    updateData.githubOwner = parsedRepo.owner;
    updateData.githubRepo = parsedRepo.repo;
  }
  if (typeof body.releaseAssetPattern === "string") {
    const trimmedPattern = body.releaseAssetPattern.trim();
    updateData.releaseAssetPattern =
      trimmedPattern.length > 0 ? trimmedPattern : "{slug}-v{version}.zip";
  }

  try {
    let plugin = await prisma.plugin.update({
      where: { id },
      data: updateData,
    });

    const repoChanged =
      (updateData.githubOwner && updateData.githubOwner !== existing.githubOwner) ||
      (updateData.githubRepo && updateData.githubRepo !== existing.githubRepo);

    if (repoChanged) {
      try {
        await syncPluginLatestRelease(plugin);
        plugin = await prisma.plugin.findUniqueOrThrow({ where: { id: plugin.id } });
      } catch {
        // Keep the plugin even if GitHub is unreachable.
      }
    }

    return NextResponse.json(plugin);
  } catch {
    return NextResponse.json({ error: "Not found or conflict" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.plugin.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
