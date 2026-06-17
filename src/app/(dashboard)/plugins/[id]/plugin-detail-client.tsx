"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, Check, X } from "lucide-react";
import { toast } from "sonner";

interface PluginInfo {
  id: string;
  slug: string;
  name: string;
  githubOwner: string;
  githubRepo: string;
}

interface SitePluginEntry {
  id: string;
  siteId: string;
  siteUrl: string;
  siteLabel: string;
  installedVersion: string;
  availableVersion: string | null;
  autoSync: boolean;
  isActive: boolean;
}

export function PluginDetailClient({
  plugin,
  sitePlugins,
}: {
  plugin: PluginInfo;
  sitePlugins: SitePluginEntry[];
}) {
  const router = useRouter();
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [loadingVersion, setLoadingVersion] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/v1/releases/${plugin.slug}`);
        if (res.ok) {
          const data = await res.json();
          setLatestVersion(data.version || null);
        }
      } catch {}
      setLoadingVersion(false);
    }
    load();
  }, [plugin.slug]);

  async function syncAll() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/v1/plugins/${plugin.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Synced v${data.version} to all non-auto-sync sites`);
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || "Sync failed");
      }
    } catch {
      toast.error("Sync failed");
    }
    setSyncing(false);
  }

  async function syncSite(siteId: string) {
    try {
      const res = await fetch(`/api/v1/plugins/${plugin.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteIds: [siteId] }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Synced v${data.version}`);
        router.refresh();
      } else {
        toast.error("Sync failed");
      }
    } catch {
      toast.error("Sync failed");
    }
  }

  async function saveManualVersion(spId: string) {
    try {
      const res = await fetch(`/api/v1/site-plugins/${spId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availableVersion: editValue || null }),
      });
      if (res.ok) {
        toast.success("Version updated");
        setEditingId(null);
        router.refresh();
      } else {
        toast.error("Failed to update version");
      }
    } catch {
      toast.error("Failed to update version");
    }
  }

  async function toggleAutoSync(spId: string, autoSync: boolean) {
    setTogglingId(spId);
    try {
      const res = await fetch(`/api/v1/site-plugins/${spId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSync }),
      });
      if (res.ok) {
        toast.success(autoSync ? "Auto-sync enabled" : "Auto-sync disabled");
        router.refresh();
      } else {
        toast.error("Failed to toggle auto-sync");
      }
    } catch {
      toast.error("Failed to toggle auto-sync");
    }
    setTogglingId(null);
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Latest Release
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {loadingVersion ? "..." : latestVersion ? `v${latestVersion}` : "N/A"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sites</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{sitePlugins.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">GitHub</CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={`https://github.com/${plugin.githubOwner}/${plugin.githubRepo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm hover:underline text-muted-foreground"
            >
              {plugin.githubOwner}/{plugin.githubRepo}
            </a>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Version Rollout</CardTitle>
            <CardDescription>
              Each site is frozen at its installed version by default. Sync the latest release
              to bump the available version, or enable auto-sync for automatic updates.
            </CardDescription>
          </div>
          {sitePlugins.length > 0 && (
            <Button onClick={syncAll} disabled={syncing || !latestVersion}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              Sync Latest to All
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {sitePlugins.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No sites have this plugin installed yet. Sites will appear here
              after they report their plugin inventory via heartbeat.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Installed</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Auto-Sync</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sitePlugins.map((sp) => (
                  <TableRow key={sp.id}>
                    <TableCell>
                      <Link
                        href={`/sites/${sp.siteId}`}
                        className="font-medium hover:underline"
                      >
                        {sp.siteUrl}
                      </Link>
                      {!sp.isActive && (
                        <Badge variant="outline" className="ml-2 border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">v{sp.installedVersion}</span>
                    </TableCell>
                    <TableCell>
                      {editingId === sp.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            placeholder="e.g. 1.2.3"
                            className="h-8 w-32"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => saveManualVersion(sp.id)}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="text-left hover:underline cursor-pointer"
                          onClick={() => {
                            setEditingId(sp.id);
                            setEditValue(sp.availableVersion || sp.installedVersion);
                          }}
                        >
                          {sp.autoSync ? (
                            <Badge variant="outline">Auto</Badge>
                          ) : (
                            <Badge variant="secondary">
                              v{sp.availableVersion || sp.installedVersion}
                            </Badge>
                          )}
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={sp.autoSync}
                        onCheckedChange={(checked) => toggleAutoSync(sp.id, checked)}
                        disabled={togglingId === sp.id}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => syncSite(sp.siteId)}
                        disabled={!latestVersion || sp.autoSync}
                        title={sp.autoSync ? "Auto-sync is enabled" : "Sync latest version"}
                      >
                        <RefreshCw className="mr-1 h-3.5 w-3.5" />
                        Sync
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
