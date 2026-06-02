"use client";

import { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type OAuthProviderInfo = { id: string; name: string };

const OAUTH_PROVIDERS: Record<string, { label: string }> = {
  github: { label: "GitHub" },
  google: { label: "Google" },
};

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [enabledOAuthProviders, setEnabledOAuthProviders] = useState<OAuthProviderInfo[]>([]);
  const [oauthErrorCode, setOauthErrorCode] = useState<string | null>(null);
  const oauthErrorMessage = getOauthErrorMessage(oauthErrorCode);

  useEffect(() => {
    let mounted = true;
    getProviders()
      .then((providers) => {
        if (!mounted || !providers) return;
        const oauth = Object.values(providers)
          .filter((p) => p.id !== "credentials" && p.id in OAUTH_PROVIDERS)
          .map((p) => ({ id: p.id, name: OAUTH_PROVIDERS[p.id]?.label ?? p.name }));
        setEnabledOAuthProviders(oauth);
      })
      .catch(() => {
        if (!mounted) return;
        setEnabledOAuthProviders([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOauthErrorCode(params.get("error"));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  async function handleOAuthSignIn(providerId: string) {
    setOauthLoading(providerId);
    await signIn(providerId, { callbackUrl: "/" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">WP Private Updater</CardTitle>
          <CardDescription>Sign in to manage your plugins and licenses</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {oauthErrorMessage && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {oauthErrorMessage}
              </div>
            )}
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
            {enabledOAuthProviders.map((provider) => (
              <Button
                key={provider.id}
                type="button"
                variant="outline"
                className="w-full"
                disabled={oauthLoading === provider.id}
                onClick={() => handleOAuthSignIn(provider.id)}
              >
                {oauthLoading === provider.id
                  ? "Redirecting..."
                  : `Continue with ${provider.name}`}
              </Button>
            ))}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function getOauthErrorMessage(errorCode: string | null): string | null {
  switch (errorCode) {
    case "AccessDenied":
      return "Access denied by authentication provider.";
    case "org_not_configured":
      return "GitHub org restriction is not configured on the server.";
    case "github_token_missing":
      return "GitHub did not return an access token.";
    case "org_membership_inactive":
      return "Your GitHub org membership is not active.";
    case "org_not_found_for_user":
      return "Your GitHub account is not a member of the allowed org.";
    case "org_api_error":
      return "Could not verify GitHub org membership due to API response.";
    case "org_check_network_error":
      return "Could not verify GitHub org membership due to network error.";
    case "google_hd_mismatch":
      return "Your Google account is not part of the allowed organization.";
    case "google_email_missing":
      return "Google did not return an email address.";
    case "account_disabled":
      return "Your account has been disabled. Contact an administrator.";
    default:
      return null;
  }
}
