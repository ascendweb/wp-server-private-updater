import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { SignJWT } from "jose";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "secret");

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { site_url, callback_url, plugin_slug } = body;

  if (!site_url || !callback_url) {
    return NextResponse.json(
      { error: "Missing site_url or callback_url" },
      { status: 400 }
    );
  }

  const token = await new SignJWT({
    site_url,
    callback_url,
    plugin_slug: plugin_slug || null,
    user_id: session.user.id,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m")
    .setIssuedAt()
    .sign(secret);

  const serverUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin;
  const approvalUrl = `${serverUrl}/connect/approve?token=${token}`;

  return NextResponse.json({ approval_url: approvalUrl });
}
