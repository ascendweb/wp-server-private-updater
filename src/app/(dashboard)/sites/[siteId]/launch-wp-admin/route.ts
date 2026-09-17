import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  launchErrorHtml,
  launchFormHtml,
  launchResponseHeaders,
  mintSsoTicket,
  requestIp,
  type SsoMintFailure,
} from "@/lib/sso";

type RouteContext = { params: Promise<{ siteId: string }> };

export const dynamic = "force-dynamic";

const MINT_ERRORS: Record<SsoMintFailure, { status: number; title: string; message: string }> = {
  unauthorized: {
    status: 401,
    title: "Sign in required",
    message: "Sign in to TacoWP before opening WordPress admin.",
  },
  user_disabled: {
    status: 403,
    title: "Account disabled",
    message: "This TacoWP account cannot open WordPress admin.",
  },
  site_not_found: {
    status: 404,
    title: "Site not found",
    message: "That site is not in TacoWP.",
  },
  site_inactive: {
    status: 403,
    title: "Site archived",
    message: "Restore the site before opening WordPress admin.",
  },
  no_site_token: {
    status: 409,
    title: "Site not connected",
    message: "This site has not registered a site token yet. Open it from WordPress admin once so TacoWP can connect.",
  },
  https_required: {
    status: 400,
    title: "HTTPS required",
    message: "WordPress admin launch requires an HTTPS site URL.",
  },
  invalid_email: {
    status: 400,
    title: "Invalid login email",
    message: "Set a valid WordPress login email on this TacoWP user.",
  },
  rate_limited: {
    status: 429,
    title: "Too many attempts",
    message: "Wait a moment before opening WordPress admin again.",
  },
};

async function handleLaunch(req: NextRequest, context: RouteContext) {
  const session = await auth();
  const { siteId } = await context.params;
  const backHref = `/sites/${encodeURIComponent(siteId)}`;
  const ip = requestIp(req.headers);

  if (!session?.user?.id) {
    return new NextResponse(
      launchErrorHtml("Sign in required", MINT_ERRORS.unauthorized.message, "/login"),
      { status: 401, headers: launchResponseHeaders() }
    );
  }

  const minted = await mintSsoTicket({ userId: session.user.id, siteId, ip });
  if (!minted.ok) {
    const error = MINT_ERRORS[minted.reason];
    return new NextResponse(launchErrorHtml(error.title, error.message, backHref), {
      status: error.status,
      headers: launchResponseHeaders(),
    });
  }

  return new NextResponse(launchFormHtml(minted.siteUrl, minted.ticket), {
    status: 200,
    headers: launchResponseHeaders(minted.siteUrl),
  });
}

export async function GET(req: NextRequest, context: RouteContext) {
  return handleLaunch(req, context);
}

export async function POST(req: NextRequest, context: RouteContext) {
  return handleLaunch(req, context);
}
