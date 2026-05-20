import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { compareSync } from "bcryptjs";
import { prisma } from "./db";

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
        if (!user) return null;

        const valid = compareSync(password, user.password);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    ...githubProvider,
  ],
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ account }) {
      if (account?.provider !== "github") return true;
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
