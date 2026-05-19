"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SettingsPage() {
  const serverUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="github">GitHub App</TabsTrigger>
          <TabsTrigger value="wp">WP Plugin</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Server Information</CardTitle>
              <CardDescription>
                These values are configured via environment variables.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Server URL</Label>
                <Input value={serverUrl} readOnly />
                <p className="text-xs text-muted-foreground">
                  Set via NEXTAUTH_URL environment variable.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="github" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>GitHub App Configuration</CardTitle>
              <CardDescription>
                The GitHub App is configured via environment variables. These are
                read-only here for reference.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>App ID</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={process.env.NEXT_PUBLIC_GITHUB_APP_ID || "Not configured"}
                    readOnly
                  />
                  <Badge
                    variant={
                      process.env.NEXT_PUBLIC_GITHUB_APP_ID
                        ? "default"
                        : "destructive"
                    }
                  >
                    {process.env.NEXT_PUBLIC_GITHUB_APP_ID ? "Set" : "Missing"}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Installation ID</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={
                      process.env.NEXT_PUBLIC_GITHUB_APP_INSTALLATION_ID ||
                      "Not configured"
                    }
                    readOnly
                  />
                  <Badge
                    variant={
                      process.env.NEXT_PUBLIC_GITHUB_APP_INSTALLATION_ID
                        ? "default"
                        : "destructive"
                    }
                  >
                    {process.env.NEXT_PUBLIC_GITHUB_APP_INSTALLATION_ID
                      ? "Set"
                      : "Missing"}
                  </Badge>
                </div>
              </div>
              <div className="rounded-md bg-muted p-4 text-sm">
                <p className="font-medium mb-2">Setup Instructions</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>
                    Create a GitHub App at{" "}
                    <code>github.com/settings/apps/new</code>
                  </li>
                  <li>
                    Grant <code>contents:read</code> permission
                  </li>
                  <li>Install the app on your org/repos</li>
                  <li>
                    Set <code>GITHUB_APP_ID</code>,{" "}
                    <code>GITHUB_APP_PRIVATE_KEY</code>, and{" "}
                    <code>GITHUB_APP_INSTALLATION_ID</code> in your environment
                  </li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>WordPress Plugin Setup</CardTitle>
              <CardDescription>
                Instructions for setting up the WP Private Updater client plugin.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md bg-muted p-4 text-sm">
                <p className="font-medium mb-2">Installation Steps</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>
                    Upload the <code>wp-private-updater</code> plugin to your WP
                    site
                  </li>
                  <li>Activate the plugin</li>
                  <li>
                    Go to <strong>Settings &gt; Private Updater</strong>
                  </li>
                  <li>
                    Enter this server URL: <code>{serverUrl}</code>
                  </li>
                  <li>
                    Either enter a license key manually or click
                    &quot;Connect&quot; to authorize automatically
                  </li>
                </ol>
              </div>
              <div className="space-y-2">
                <Label>Update Check Endpoint</Label>
                <Input value={`${serverUrl}/api/v1/update-check`} readOnly />
              </div>
              <div className="space-y-2">
                <Label>Download Endpoint</Label>
                <Input
                  value={`${serverUrl}/api/v1/download/{slug}/{version}`}
                  readOnly
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
