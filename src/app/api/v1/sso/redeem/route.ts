import { NextRequest, NextResponse } from "next/server";
import { redeemSsoTicket, requestIp } from "@/lib/sso";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { site_token?: unknown; ticket?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid ticket" }, { status: 400 });
  }

  const siteToken = typeof body.site_token === "string" ? body.site_token.trim() : "";
  const ticket = typeof body.ticket === "string" ? body.ticket.trim() : "";

  if (!siteToken || !ticket) {
    return NextResponse.json({ error: "Invalid ticket" }, { status: 400 });
  }

  const result = await redeemSsoTicket({
    siteToken,
    ticket,
    ip: requestIp(req.headers),
  });

  if (!result.ok) {
    return NextResponse.json({ error: "Invalid ticket" }, { status: 403 });
  }

  return NextResponse.json({ email: result.email });
}
