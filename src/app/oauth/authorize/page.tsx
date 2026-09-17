import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { mcpIssuer, mcpResourceUrl } from "@/lib/mcp/origin";
import { CheeseSprinkleBackground } from "@/components/cheese-sprinkle-background";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveClient } from "./actions";
import { AuthorizeConsent } from "./authorize-consent";

export const dynamic = "force-dynamic";

function errorPage(message: string) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <CheeseSprinkleBackground />
      <Card className="relative z-10 w-full max-w-md" size="lg">
        <CardHeader>
          <CardTitle>Cannot connect</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const get = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value || "";
  };

  const clientId = get("client_id");
  const redirectUri = get("redirect_uri");
  const responseType = get("response_type") || "code";
  const state = get("state");
  const codeChallenge = get("code_challenge");
  const method = get("code_challenge_method") || "S256";
  const scope = get("scope");
  const resource = get("resource") || mcpResourceUrl();

  if (responseType !== "code") {
    return errorPage("Only the authorization code flow is supported.");
  }
  if (!clientId || !redirectUri || !codeChallenge) {
    return errorPage("Missing client_id, redirect_uri, or code_challenge.");
  }
  if (method !== "S256") {
    return errorPage("code_challenge_method must be S256.");
  }

  const session = await auth();
  if (!session?.user) {
    const next = `/oauth/authorize?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: method,
      scope,
      resource,
    }).toString()}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(next)}`);
  }

  const resolved = await resolveClient(clientId, redirectUri);
  if ("error" in resolved) {
    return errorPage(resolved.error || "Unknown client");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <CheeseSprinkleBackground />
      <Card className="relative z-10 w-full max-w-md" size="lg">
        <CardHeader>
          <img src="/branding/logo-full.svg" className="h-12 mx-auto mb-2" alt="" />
          <CardTitle className="text-center">Connect an AI client</CardTitle>
          <CardDescription className="text-center">
            {resolved.client.name} wants read access to your site inventory.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthorizeConsent
            clientId={clientId}
            clientName={resolved.client.name}
            redirectUri={redirectUri}
            state={state}
            codeChallenge={codeChallenge}
            scope={scope}
            resource={resource}
            issuer={mcpIssuer()}
            userEmail={session.user.email || ""}
          />
        </CardContent>
      </Card>
    </div>
  );
}
