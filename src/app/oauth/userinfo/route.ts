import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { corsPreflight, oauthCorsHeaders } from "@/lib/mcp/cors";
import { verifyAccessToken } from "@/lib/mcp/tokens";

export async function GET(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const auth = token ? await verifyAccessToken(token) : undefined;
  if (!auth) {
    return NextResponse.json(
      { error: "invalid_token" },
      {
        status: 401,
        headers: {
          ...oauthCorsHeaders,
          "WWW-Authenticate": "Bearer",
        },
      }
    );
  }

  const userId = auth.extra?.userId;
  if (typeof userId !== "string") {
    return NextResponse.json(
      { sub: auth.clientId },
      { headers: oauthCorsHeaders }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401, headers: oauthCorsHeaders });
  }

  return NextResponse.json(
    {
      sub: user.id,
      email: user.email,
      email_verified: true,
      name: user.name,
    },
    { headers: oauthCorsHeaders }
  );
}

export function OPTIONS() {
  return corsPreflight();
}
