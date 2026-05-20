import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { compareSync } from "bcryptjs";
import { prisma } from "./db";

const githubClientId = process.env.GITHUB_AUTH_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_AUTH_CLIENT_SECRET;
const githubAllowedOrg = process.env.GITHUB_AUTH_ALLOWED_ORG;
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
      if (!githubAllowedOrg) return false;

      const accessToken = account.access_token;
      if (!accessToken) return false;

      try {
        const response = await fetch(
          `https://api.github.com/user/memberships/orgs/${encodeURIComponent(githubAllowedOrg)}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.github+json",
              "User-Agent": "wp-private-updater-auth",
            },
          }
        );

        if (!response.ok) return false;
        const membership = (await response.json()) as { state?: string };
        return membership.state === "active";
      } catch {
        return false;
      }
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
