import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseGitHubRepoUrl } from "@/lib/github";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plugins = await prisma.plugin.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(plugins);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { slug, name, description, githubUrl, releaseAssetPattern } = body;

  if (!slug || !name || !githubUrl) {
    return NextResponse.json(
      { error: "Missing required fields: slug, name, githubUrl" },
      { status: 400 }
    );
  }

  const parsedRepo = parseGitHubRepoUrl(String(githubUrl));
  if (!parsedRepo) {
    return NextResponse.json(
      { error: "Invalid GitHub repository URL. Expected format: https://github.com/owner/repo" },
      { status: 400 }
    );
  }

  try {
    const plugin = await prisma.plugin.create({
      data: {
        slug,
        name,
        description,
        githubOwner: parsedRepo.owner,
        githubRepo: parsedRepo.repo,
        releaseAssetPattern:
          typeof releaseAssetPattern === "string" && releaseAssetPattern.trim().length > 0
            ? releaseAssetPattern.trim()
            : "{slug}-v{version}.zip",
      } as never,
    });
    return NextResponse.json(plugin, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Plugin with this slug or repo already exists" },
      { status: 409 }
    );
  }
}
