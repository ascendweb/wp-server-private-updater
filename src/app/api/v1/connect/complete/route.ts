import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jwtVerify, SignJWT } from "jose";
import { prisma } from "@/lib/db";
import { normalizeSiteUrl } from "@/lib/license";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "secret");

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { token } = body;

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  let payload;
  try {
    const result = await jwtVerify(token, secret);
    payload = result.payload as {
      site_url: string;
      callback_url: string;
      plugin_slug: string | null;
    };
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

  const normalizedUrl = normalizeSiteUrl(payload.site_url);
  const pushUrl = normalizedUrl + "/wp-json/wppu/v1";
  const siteToken = crypto.randomUUID();

  const site = await prisma.site.upsert({
    where: { url: normalizedUrl },
    create: {
      url: normalizedUrl,
      label: normalizedUrl,
      pushUrl,
      siteToken,
    },
    update: {
      pushUrl,
      siteToken,
    },
  });

  let pluginId: string | null = null;
  if (payload.plugin_slug) {
    const plugin = await prisma.plugin.findUnique({
      where: { slug: payload.plugin_slug },
    });
    if (plugin) pluginId = plugin.id;
  }

  const license = await prisma.license.create({
    data: {
      siteUrl: normalizedUrl,
      siteId: site.id,
      pluginId,
      label: `Auto-connected: ${normalizedUrl}`,
      status: "active",
    },
  });

  const callbackToken = await new SignJWT({
    license_key: license.key,
    site_url: normalizedUrl,
    site_token: siteToken,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m")
    .setIssuedAt()
    .sign(secret);

  return NextResponse.json({
    success: true,
    license_key: license.key,
    callback_url: payload.callback_url,
    callback_token: callbackToken,
  });
}
