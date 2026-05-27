import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { compareSync } from "bcryptjs";
import { prisma } from "./db";

/* ── GitHub OAuth ─────────────────────────────────────────────── */

const githubClientId = process.env.GITHUB_AUTH_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_AUTH_CLIENT_SECRET;
const githubAllowedOrg = process.env.GITHUB_AUTH_ALLOWED_ORG?.trim().replace(/^@/, "");
const githubProvider =
  githubClientId && githubClientSecret && githubAllowedOrg
    ? [
        GitHub({
          clientId: githubClientId,
          clientSecret: githubClientSecret,
          authorization: {
            params: { scope: "read:user user:email read:org" },
          },
        }),
      ]
    : [];

type GithubOrgCheckResult =
  | { ok: true }
  | { ok: false; reason: string; detail?: string };

async function checkGithubOrgMembership(
  accessToken: string,
  allowedOrg: string
): Promise<GithubOrgCheckResult> {
  try {
    const membershipResponse = await fetch(
      `https://api.github.com/user/memberships/orgs/${encodeURIComponent(allowedOrg)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "wp-private-updater-auth",
        },
      }
    );

    if (membershipResponse.ok) {
      const membership = (await membershipResponse.json()) as { state?: string };
      if (membership.state === "active") return { ok: true };
      return {
        ok: false,
        reason: "org_membership_inactive",
        detail: `Membership state is '${membership.state || "unknown"}'.`,
      };
    }

    const orgsResponse = await fetch("https://api.github.com/user/orgs?per_page=100", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "wp-private-updater-auth",
      },
    });

    if (!orgsResponse.ok) {
      return {
        ok: false,
        reason: "org_api_error",
        detail: `membership_status=${membershipResponse.status}, orgs_status=${orgsResponse.status}`,
      };
    }

    const orgs = (await orgsResponse.json()) as Array<{ login?: string }>;
    const inOrg = orgs.some(
      (org) => org.login?.toLowerCase() === allowedOrg.toLowerCase()
    );
    if (inOrg) return { ok: true };

    return {
      ok: false,
      reason: "org_not_found_for_user",
      detail: "User org list does not include configured org.",
    };
  } catch {
    return {
      ok: false,
      reason: "org_check_network_error",
    };
  }
}

/* ── Google OAuth ─────────────────────────────────────────────── */

const googleClientId = process.env.GOOGLE_AUTH_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_AUTH_CLIENT_SECRET;
const googleAllowedDomain = process.env.GOOGLE_AUTH_ALLOWED_DOMAIN?.trim().toLowerCase();
const googleProvider =
  googleClientId && googleClientSecret
    ? [
        Google({
          clientId: googleClientId,
          clientSecret: googleClientSecret,
          authorization: {
            params: {
              ...(googleAllowedDomain ? { hd: googleAllowedDomain } : {}),
            },
          },
        }),
      ]
    : [];

async function upsertOAuthUser(
  provider: string,
  providerAccountId: string,
  email: string,
  name: string | null
) {
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: { email, name, accounts: { create: { provider, providerAccountId } } },
    });
  } else {
    const existing = await prisma.account.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
    });
    if (!existing) {
      await prisma.account.create({
        data: { userId: user.id, provider, providerAccountId },
      });
    }
  }

  return user;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.password) return null;
        if (user.status === "disabled") return null;

        const valid = compareSync(password, user.password);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    ...githubProvider,
    ...googleProvider,
  ],
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user: authUser, account, profile }) {
      if (account?.provider === "github") {
        if (!githubAllowedOrg) return "/login?error=org_not_configured";

        const accessToken = account.access_token;
        if (!accessToken) return "/login?error=github_token_missing";

        const orgCheck = await checkGithubOrgMembership(accessToken, githubAllowedOrg);
        if (!orgCheck.ok) {
          console.warn("[auth] GitHub org access denied", {
            org: githubAllowedOrg,
            reason: orgCheck.reason,
            detail: orgCheck.detail,
          });
          return `/login?error=${encodeURIComponent(orgCheck.reason)}`;
        }

        const email = authUser.email ?? (profile?.email as string | undefined);
        if (!email) return "/login?error=github_token_missing";

        const dbUser = await upsertOAuthUser(
          "github",
          account.providerAccountId,
          email,
          authUser.name ?? null
        );
        if (dbUser.status === "disabled") return "/login?error=account_disabled";
        authUser.id = dbUser.id;
      }

      if (account?.provider === "google") {
        if (googleAllowedDomain) {
          const hd = (profile as Record<string, unknown> | undefined)?.hd as string | undefined;
          if (hd?.toLowerCase() !== googleAllowedDomain) {
            console.warn("[auth] Google domain access denied", {
              allowedDomain: googleAllowedDomain,
              hd: hd ?? "none",
            });
            return "/login?error=google_hd_mismatch";
          }
        }

        const email = authUser.email ?? (profile?.email as string | undefined);
        if (!email) return "/login?error=google_email_missing";

        const dbUser = await upsertOAuthUser(
          "google",
          account.providerAccountId,
          email,
          authUser.name ?? null
        );
        if (dbUser.status === "disabled") return "/login?error=account_disabled";
        authUser.id = dbUser.id;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
