"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

function ApproveContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"pending" | "loading" | "success" | "error">("pending");
  const [result, setResult] = useState<{ license_key: string; callback_url: string; callback_token: string } | null>(null);
  const [error, setError] = useState("");

  async function handleApprove() {
    setStatus("loading");
    try {
      const res = await fetch("/api/v1/connect/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to complete connection");
      }

      const data = await res.json();
      setResult(data);
      setStatus("success");

      const separator = data.callback_url.includes("?") ? "&" : "?";
      const callbackFull = `${data.callback_url}${separator}token=${encodeURIComponent(data.callback_token)}`;
      window.location.href = callbackFull;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  }

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p>Invalid connection request. No token provided.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>Authorize Connection</CardTitle>
        <CardDescription>
          A WordPress site is requesting to connect for plugin updates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "pending" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Click approve to generate a license key and send it back to the
              requesting site.
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleApprove}>
                Approve
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.close()}
              >
                Deny
              </Button>
            </div>
          </div>
        )}
        {status === "loading" && (
          <div className="text-center py-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Generating license key...
            </p>
          </div>
        )}
        {status === "success" && result && (
          <div className="text-center py-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="font-medium">Connection authorized</p>
            <p className="text-sm text-muted-foreground mt-1">
              Redirecting back to WordPress...
            </p>
          </div>
        )}
        {status === "error" && (
          <div className="text-center py-4">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="font-medium">Connection failed</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ApprovePage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Suspense
        fallback={
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            </CardContent>
          </Card>
        }
      >
        <ApproveContent />
      </Suspense>
    </div>
  );
}
