import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeSiteUrl, findSiteByUrl } from "@/lib/license";
import { excludeArchivedSiteLicenses, isSiteArchived } from "@/lib/site-status";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const licenses = await prisma.license.findMany({
    where: excludeArchivedSiteLicenses,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(licenses);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { siteUrl, label } = body;

  if (!siteUrl) {
    return NextResponse.json({ error: "Missing siteUrl" }, { status: 400 });
  }

  const existingSite = await findSiteByUrl(siteUrl);
  if (isSiteArchived(existingSite)) {
    return NextResponse.json(
      { error: "This site is archived. Restore it before creating a new license." },
      { status: 400 }
    );
  }

  const license = await prisma.license.create({
    data: {
      siteUrl: normalizeSiteUrl(siteUrl),
      label: label || null,
      status: "active",
    },
  });

  return NextResponse.json(license, { status: 201 });
}
