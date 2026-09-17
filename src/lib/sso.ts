import { createHash, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SITE_STATUS_ACTIVE } from "@/lib/site-status";

export const SSO_TICKET_TTL_SECONDS = 60;
export const SSO_MINT_LIMIT = 8;
export const SSO_MINT_WINDOW_MS = 60_000;
export const SSO_TICKET_PATTERN = /^[a-f0-9]{64}$/;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SsoMintFailure =
  | "unauthorized"
  | "user_disabled"
  | "site_not_found"
  | "site_inactive"
  | "no_site_token"
  | "https_required"
  | "invalid_email"
  | "rate_limited";

export type SsoRedeemFailure = "invalid" | "expired" | "already_used" | "wrong_site";

export function hashSsoTicket(ticket: string): string {
  return createHash("sha256").update(ticket, "utf8").digest("hex");
}

export function newSsoTicketSecret(): string {
  return randomBytes(32).toString("hex");
}

export function isValidSsoTicketSecret(ticket: string): boolean {
  return SSO_TICKET_PATTERN.test(ticket);
}

export function normalizeLoginEmail(value: string | null | undefined, fallback: string): string | null {
  const raw = (value?.trim() || fallback).trim();
  if (!EMAIL_PATTERN.test(raw)) return null;
  return raw;
}

export function parseWpLoginEmail(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!EMAIL_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

export function siteUrlAllowsSso(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return true;
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
}

export function ssoSiteActionUrl(siteUrl: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/`;
}

export function requestIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const realIp = headers.get("x-real-ip")?.trim();
  return realIp ? realIp.slice(0, 128) : null;
}

export async function recordSsoEvent(input: {
  siteId?: string | null;
  userId?: string | null;
  email?: string | null;
  result: string;
  ip?: string | null;
}) {
  await prisma.ssoEvent.create({
    data: {
      siteId: input.siteId ?? null,
      userId: input.userId ?? null,
      email: input.email ?? null,
      result: input.result,
      ip: input.ip ?? null,
    },
  });
}

async function purgeOldSsoTickets() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.ssoTicket.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: cutoff } }, { usedAt: { lt: cutoff } }],
    },
  });
}

export async function mintSsoTicket(input: {
  userId: string;
  siteId: string;
  ip?: string | null;
}): Promise<
  | { ok: true; ticket: string; siteUrl: string; email: string }
  | { ok: false; reason: SsoMintFailure }
> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, status: true, wpLoginEmail: true },
  });
  if (!user) {
    await recordSsoEvent({ userId: input.userId, siteId: input.siteId, result: "unauthorized", ip: input.ip });
    return { ok: false, reason: "unauthorized" };
  }
  if (user.status !== "active") {
    await recordSsoEvent({ userId: user.id, siteId: input.siteId, result: "user_disabled", ip: input.ip });
    return { ok: false, reason: "user_disabled" };
  }

  const site = await prisma.site.findUnique({
    where: { id: input.siteId },
    select: { id: true, url: true, status: true, siteToken: true },
  });
  if (!site) {
    await recordSsoEvent({ userId: user.id, siteId: input.siteId, result: "site_not_found", ip: input.ip });
    return { ok: false, reason: "site_not_found" };
  }
  if (site.status !== SITE_STATUS_ACTIVE) {
    await recordSsoEvent({ userId: user.id, siteId: site.id, result: "site_inactive", ip: input.ip });
    return { ok: false, reason: "site_inactive" };
  }
  if (!site.siteToken) {
    await recordSsoEvent({ userId: user.id, siteId: site.id, result: "no_site_token", ip: input.ip });
    return { ok: false, reason: "no_site_token" };
  }
  if (!siteUrlAllowsSso(site.url)) {
    await recordSsoEvent({ userId: user.id, siteId: site.id, result: "https_required", ip: input.ip });
    return { ok: false, reason: "https_required" };
  }

  const email = normalizeLoginEmail(user.wpLoginEmail, user.email);
  if (!email) {
    await recordSsoEvent({ userId: user.id, siteId: site.id, result: "invalid_email", ip: input.ip });
    return { ok: false, reason: "invalid_email" };
  }

  const since = new Date(Date.now() - SSO_MINT_WINDOW_MS);
  const recent = await prisma.ssoEvent.count({
    where: { userId: user.id, createdAt: { gt: since } },
  });
  if (recent >= SSO_MINT_LIMIT) {
    await recordSsoEvent({ userId: user.id, siteId: site.id, email, result: "rate_limited", ip: input.ip });
    return { ok: false, reason: "rate_limited" };
  }

  const ticket = newSsoTicketSecret();
  const expiresAt = new Date(Date.now() + SSO_TICKET_TTL_SECONDS * 1000);

  await prisma.ssoTicket.create({
    data: {
      tokenHash: hashSsoTicket(ticket),
      userId: user.id,
      siteId: site.id,
      email,
      expiresAt,
    },
  });
  await recordSsoEvent({
    userId: user.id,
    siteId: site.id,
    email,
    result: "minted",
    ip: input.ip,
  });
  void purgeOldSsoTickets().catch(() => undefined);

  return { ok: true, ticket, siteUrl: site.url, email };
}

export async function redeemSsoTicket(input: {
  siteToken: string;
  ticket: string;
  ip?: string | null;
}): Promise<{ ok: true; email: string } | { ok: false; reason: SsoRedeemFailure }> {
  const site = await prisma.site.findFirst({
    where: { siteToken: input.siteToken, status: SITE_STATUS_ACTIVE },
    select: { id: true },
  });
  if (!site) {
    await recordSsoEvent({ result: "invalid", ip: input.ip });
    return { ok: false, reason: "invalid" };
  }

  if (!isValidSsoTicketSecret(input.ticket)) {
    await recordSsoEvent({ siteId: site.id, result: "invalid", ip: input.ip });
    return { ok: false, reason: "invalid" };
  }

  const tokenHash = hashSsoTicket(input.ticket);
  const rows = await prisma.$queryRaw<Array<{ email: string; userId: string }>>(Prisma.sql`
    UPDATE "SsoTicket"
    SET "usedAt" = NOW()
    WHERE "tokenHash" = ${tokenHash}
      AND "siteId" = ${site.id}
      AND "usedAt" IS NULL
      AND "expiresAt" > NOW()
    RETURNING email, "userId"
  `);

  const claimed = rows[0];
  if (claimed) {
    await recordSsoEvent({
      siteId: site.id,
      userId: claimed.userId,
      email: claimed.email,
      result: "redeemed",
      ip: input.ip,
    });
    return { ok: true, email: claimed.email };
  }

  const existing = await prisma.ssoTicket.findUnique({
    where: { tokenHash },
    select: { siteId: true, usedAt: true, expiresAt: true, userId: true, email: true },
  });

  let reason: SsoRedeemFailure = "invalid";
  if (!existing) {
    reason = "invalid";
  } else if (existing.siteId !== site.id) {
    reason = "wrong_site";
  } else if (existing.usedAt) {
    reason = "already_used";
  } else if (existing.expiresAt.getTime() <= Date.now()) {
    reason = "expired";
  }

  await recordSsoEvent({
    siteId: site.id,
    userId: existing?.userId ?? null,
    email: existing?.siteId === site.id ? existing.email : null,
    result: reason,
    ip: input.ip,
  });
  return { ok: false, reason };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function launchFormHtml(siteUrl: string, ticket: string): string {
  const action = escapeHtml(ssoSiteActionUrl(siteUrl));
  const secret = escapeHtml(ticket);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex,nofollow">
<title>Opening WordPress admin</title>
<style>
body{font-family:system-ui,sans-serif;margin:2rem;color:#111}
button{font:inherit;padding:.5rem .9rem;cursor:pointer}
</style>
</head>
<body>
<form method="post" action="${action}" accept-charset="UTF-8">
<input type="hidden" name="wppu_action" value="sso">
<input type="hidden" name="ticket" value="${secret}">
<p>Continue to WordPress admin.</p>
<button type="submit">Continue</button>
</form>
<script>document.forms[0].submit();</script>
</body>
</html>`;
}

export function launchErrorHtml(title: string, message: string, backHref: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(title)}</title>
<style>
body{font-family:system-ui,sans-serif;margin:2rem;color:#111;max-width:36rem}
a{color:#111}
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(message)}</p>
<p><a href="${escapeHtml(backHref)}">Back to site</a></p>
</body>
</html>`;
}

export const LAUNCH_NOSTORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "Content-Type": "text/html; charset=utf-8",
} as const;

export function launchResponseHeaders(siteUrl?: string): Record<string, string> {
  const headers: Record<string, string> = { ...LAUNCH_NOSTORE_HEADERS };
  let formAction = "'none'";
  if (siteUrl) {
    try {
      formAction = new URL(siteUrl).origin;
    } catch {
      formAction = "'none'";
    }
  }
  headers["Content-Security-Policy"] =
    `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; form-action ${formAction}; base-uri 'none'`;
  return headers;
}
