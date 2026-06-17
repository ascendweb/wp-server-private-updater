import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const data: { availableVersion?: string | null; autoSync?: boolean } = {};

  if (typeof body.availableVersion === "string" || body.availableVersion === null) {
    data.availableVersion = body.availableVersion;
  }
  if (typeof body.autoSync === "boolean") {
    data.autoSync = body.autoSync;
  }

  try {
    const sp = await prisma.sitePlugin.update({
      where: { id },
      data,
    });
    return NextResponse.json(sp);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
