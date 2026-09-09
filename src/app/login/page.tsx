import { connection } from "next/server";
import { envFlagEnabled } from "@/lib/env-flag";
import { LoginClient } from "./login-client";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await connection();

  return (
    <LoginClient
      githubAuthEnabled={envFlagEnabled("GITHUB_AUTH_ENABLED")}
      googleAuthEnabled={envFlagEnabled("GOOGLE_AUTH_ENABLED")}
    />
  );
}
