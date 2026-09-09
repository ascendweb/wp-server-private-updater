import { envFlagEnabled } from "@/lib/env-flag";
import { LoginClient } from "./login-client";

export default function LoginPage() {
  return (
    <LoginClient
      githubAuthEnabled={envFlagEnabled(process.env.GITHUB_AUTH_ENABLED)}
      googleAuthEnabled={envFlagEnabled(process.env.GOOGLE_AUTH_ENABLED)}
    />
  );
}
