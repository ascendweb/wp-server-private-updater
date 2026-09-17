"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { approveMcpAuthorization } from "./actions";

export function AuthorizeConsent({
  clientId,
  redirectUri,
  state,
  codeChallenge,
  scope,
  resource,
  issuer,
  userEmail,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope: string;
  resource: string;
  issuer: string;
  userEmail: string;
}) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onAllow() {
    setLoading(true);
    setError("");
    const result = await approveMcpAuthorization({
      clientId,
      redirectUri,
      state,
      codeChallenge,
      scope,
      resource,
    });
    if (result?.redirectTo) {
      window.location.href = result.redirectTo;
      return;
    }
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  function onDeny() {
    const dest = new URL(redirectUri);
    dest.searchParams.set("error", "access_denied");
    if (state) dest.searchParams.set("state", state);
    dest.searchParams.set("iss", issuer);
    window.location.href = dest.toString();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Signed in as <span className="text-foreground">{userEmail}</span>.
      </p>
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={onAllow} disabled={loading}>
          {loading ? "Connecting..." : "Allow"}
        </Button>
        <Button className="flex-1" variant="outline" onClick={onDeny} disabled={loading}>
          Deny
        </Button>
      </div>
    </div>
  );
}
