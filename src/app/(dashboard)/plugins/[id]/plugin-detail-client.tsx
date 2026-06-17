"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, ArrowUp } from "lucide-react";
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

export function PluginDetailClient({ plugin, sitePlugins }: { plugin: PluginInfo; sitePlugins: SitePluginEntry[] }) {
  const router = useRouter();
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [loadingVersion, setLoadingVersion] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [bumpingId, setBumpingId] = useState<string | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

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
        toast.success(`Bumped v${data.version} to all non-auto-sync sites`);
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || "Bump failed");
      }
    } catch {
      toast.error("Bump failed");
    }
    setSyncing(false);
  }

  async function bumpSite(siteId: string) {
    setBumpingId(siteId);
    try {
      const res = await fetch(`/api/v1/plugins/${plugin.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteIds: [siteId] }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Bumped to v${data.version}`);
        router.refresh();
      } else {
        toast.error("Bump failed");
      }
    } catch {
      toast.error("Bump failed");
    }
    setBumpingId(null);
  }

  async function saveVersion(spId: string, value: string) {
    try {
      const res = await fetch(`/api/v1/site-plugins/${spId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availableVersion: value || null }),
      });
      if (res.ok) {
        toast.success("Version updated");
        router.refresh();
      } else {
        toast.error("Failed to update version");
      }
    } catch {
      toast.error("Failed to update version");
    }
    setEditingId(null);
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

  function isNewer(a: string, b: string): boolean {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const x = pa[i] || 0, y = pb[i] || 0;
      if (x > y) return true;
      if (x < y) return false;
    }
    return false;
  }

  function canBump(sp: SitePluginEntry) {
    if (!latestVersion || sp.autoSync) return false;
    const avail = sp.availableVersion || sp.installedVersion;
    return isNewer(latestVersion, avail);
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Latest Release</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loadingVersion ? "..." : latestVersion ? `v${latestVersion}` : "N/A"}</div>
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
            <a href={`https://github.com/${plugin.githubOwner}/${plugin.githubRepo}`} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline text-muted-foreground">
              {plugin.githubOwner}/{plugin.githubRepo}
            </a>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Version Rollout</CardTitle>
            <CardDescription>Each site is frozen at its installed version by default. Bump to push the latest release, or enable auto-sync for automatic updates.</CardDescription>
          </div>
          {sitePlugins.length > 0 && (
            <Button onClick={syncAll} disabled={syncing || !latestVersion || !sitePlugins.some(canBump)}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              Bump All
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {sitePlugins.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No sites have this plugin installed yet. Sites will appear here after they report their plugin inventory via heartbeat.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Installed</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Auto-Sync</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sitePlugins.map((sp) => {
                  const avail = sp.availableVersion || sp.installedVersion;
                  const availDiffersFromInstalled = avail !== sp.installedVersion;
                  const bumpable = canBump(sp);

                  return (
                    <TableRow key={sp.id} className="h-12">
                      <TableCell>
                        <Link href={`/sites/${sp.siteId}`} className="font-medium hover:underline">
                          {sp.siteUrl}
                        </Link>
                        {!sp.isActive && (
                          <Badge variant="subtle" className="ml-2">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">v{sp.installedVersion}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {sp.autoSync ? (
                            <Badge variant="outline">Auto</Badge>
                          ) : editingId === sp.id ? (
                            <input
                              ref={(el) => {
                                if (el) inputRefs.current.set(sp.id, el);
                              }}
                              defaultValue={avail}
                              className="rounded border border-border bg-transparent px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                              style={{ fieldSizing: "content", minWidth: "5ch" } as React.CSSProperties}
                              onBlur={(e) => {
                                const val = e.target.value.trim();
                                if (val && val !== avail) {
                                  saveVersion(sp.id, val);
                                } else {
                                  setEditingId(null);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.currentTarget.blur();
                                } else if (e.key === "Escape") {
                                  setEditingId(null);
                                }
                              }}
                            />
                          ) : (
                            <button
                              className={`text-sm text-left cursor-pointer hover:underline ${availDiffersFromInstalled ? "font-semibold text-blue-600 dark:text-blue-400" : ""}`}
                              onClick={() => {
                                setEditingId(sp.id);
                                setTimeout(() => {
                                  const input = inputRefs.current.get(sp.id);
                                  if (input) {
                                    input.focus();
                                    input.select();
                                  }
                                }, 0);
                              }}
                            >
                              v{avail}
                            </button>
                          )}
                          {bumpable && editingId !== sp.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => bumpSite(sp.siteId)}
                              disabled={bumpingId === sp.siteId}
                            >
                              <ArrowUp className="mr-1 h-3 w-3" />
                              Bump
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch checked={sp.autoSync} onCheckedChange={(checked) => toggleAutoSync(sp.id, checked)} disabled={togglingId === sp.id} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
