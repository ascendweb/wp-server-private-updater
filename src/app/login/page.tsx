import { connection } from "next/server";
import { envFlagEnabled } from "@/lib/env-flag";
import { LoginClient } from "./login-client";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function safeCallbackUrl(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;

  return (
    <LoginClient
      githubAuthEnabled={envFlagEnabled("GITHUB_AUTH_ENABLED")}
      googleAuthEnabled={envFlagEnabled("GOOGLE_AUTH_ENABLED")}
      oauthErrorCode={first(params.error)}
      callbackUrl={safeCallbackUrl(first(params.callbackUrl))}
    />
  );
}
