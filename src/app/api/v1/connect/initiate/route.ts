import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { getServerOrigin } from "@/lib/utils";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "secret");

// Public endpoint — no auth required.
// Security gate is the /connect/approve step where the admin must be logged in.
export async function POST(req: NextRequest) {
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
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m")
    .setIssuedAt()
    .sign(secret);

  const serverUrl = getServerOrigin(req);
  const approvalUrl = `${serverUrl}/connect/approve?token=${token}`;

  return NextResponse.json({ approval_url: approvalUrl });
}
