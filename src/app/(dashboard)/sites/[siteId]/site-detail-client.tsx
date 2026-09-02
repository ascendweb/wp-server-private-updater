"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, Download, MoreHorizontal, History, CircleCheck, XCircle, Clock, Loader2, Trash2, ArrowUp, RotateCw, Eraser } from "lucide-react";
import { toast } from "sonner";
import { sendCommand, deleteSite, bumpSitePlugin } from "./actions";
import { sendSiteCommand } from "../actions";

interface SitePlugin {
  id: string;
  pluginSlug: string;
  pluginName: string;
  installedVersion: string;
  availableVersion: string | null;
  autoSync: boolean;
  isActive: boolean;
  isManaged: boolean;
  lastReportedAt: string;
}

interface CommandEntry {
  id: string;
  type: string;
  pluginSlug: string;
  targetVersion: string | null;
  status: string;
  result: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface AvailablePlugin {
  id: string;
  slug: string;
  name: string;
}

interface SiteInfo {
  id: string;
  url: string;
  siteToken: boolean;
  licenseCount: number;
}

const INFLIGHT_STATUSES = new Set(["pending", "delivered", "in_progress"]);

export function SiteDetailClient({ site, sitePlugins, commands, availableToInstall }: { site: SiteInfo; sitePlugins: SitePlugin[]; commands: CommandEntry[]; availableToInstall: AvailablePlugin[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bumpingId, setBumpingId] = useState<string | null>(null);
  const [selectedCommand, setSelectedCommand] = useState<CommandEntry | null>(null);
  const [commandLog, setCommandLog] = useState(commands);
  const [pollNonce, setPollNonce] = useState(0);

  useEffect(() => {
    setCommandLog(commands);
  }, [commands]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch(`/api/v1/sites/${site.id}/commands`);
        if (res.ok) {
          const data = (await res.json()) as { commands: CommandEntry[] };
          if (!cancelled && Array.isArray(data.commands)) {
            setCommandLog(data.commands);
            const inflight = data.commands.some((cmd) => INFLIGHT_STATUSES.has(cmd.status));
            timer = setTimeout(poll, inflight ? 2000 : 8000);
            return;
          }
        }
      } catch {}
      if (!cancelled) {
        timer = setTimeout(poll, 8000);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [site.id, pollNonce]);

  useEffect(() => {
    if (!selectedCommand) return;
    const next = commandLog.find((cmd) => cmd.id === selectedCommand.id);
    if (
      next &&
      (next.status !== selectedCommand.status ||
        next.result !== selectedCommand.result ||
        next.completedAt !== selectedCommand.completedAt)
    ) {
      setSelectedCommand(next);
    }
  }, [commandLog, selectedCommand]);

  async function handleBump(sitePluginId: string, pluginSlug: string) {
    setBumpingId(sitePluginId);
    try {
      await bumpSitePlugin(sitePluginId, pluginSlug);
      router.refresh();
      toast.success("Bumped to latest version");
    } catch {
      toast.error("Failed to bump version");
    }
    setBumpingId(null);
  }

  async function handleCommand(type: "update" | "install" | "rollback", pluginSlug: string, targetVersion?: string) {
    const key = `${type}-${pluginSlug}`;
    setBusy(key);
    try {
      await sendCommand(site.id, type, pluginSlug, targetVersion || null);
      setPollNonce((n) => n + 1);
      router.refresh();
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} command sent`);
    } catch {
      toast.error(`Failed to send ${type} command`);
    }
    setBusy(null);
  }

  async function handleSiteCommand(type: "refresh" | "purge_cache") {
    setBusy(type);
    try {
      await sendSiteCommand(site.id, type);
      setPollNonce((n) => n + 1);
      router.refresh();
      toast.success(type === "refresh" ? "Refresh inventory command sent" : "Purge caches command sent");
    } catch {
      toast.error(type === "refresh" ? "Failed to send refresh" : "Failed to send cache purge");
    }
    setBusy(null);
  }

  async function handleDeleteSite() {
    if (!confirm(`Delete site "${site.url}" and all its licenses and data? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteSite(site.id);
      toast.success("Site deleted");
      router.push("/sites");
    } catch {
      toast.error("Failed to delete site");
      setDeleting(false);
    }
  }

  function statusIcon(status: string) {
    switch (status) {
      case "completed":
        return <CircleCheck className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "pending":
      case "delivered":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "in_progress":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      default:
        return null;
    }
  }

  function formatStatus(status: string) {
    switch (status) {
      case "pending":
        return "Pending";
      case "delivered":
        return "Delivered";
      case "in_progress":
        return "In Progress";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      default:
        return status;
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => handleSiteCommand("refresh")} disabled={busy === "refresh"}>
          <RotateCw className={`mr-2 h-4 w-4 ${busy === "refresh" ? "animate-spin" : ""}`} />
          Refresh inventory
        </Button>
        <Button variant="outline" onClick={() => handleSiteCommand("purge_cache")} disabled={busy === "purge_cache"}>
          <Eraser className="mr-2 h-4 w-4" />
          Purge caches
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Licenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{site.licenseCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Plugins Installed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{sitePlugins.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Site Token</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={site.siteToken ? "success" : "warn"} className="text-lg">
              {site.siteToken ? "Active" : "Pending"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Installed Plugins</CardTitle>
          <CardDescription>Plugins reported by this site&apos;s heartbeat. Managed plugins can be updated or rolled back.</CardDescription>
        </CardHeader>
        <CardContent>
          {sitePlugins.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No plugins reported yet. The site will report its plugin inventory on its next heartbeat.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plugin</TableHead>
                  <TableHead>Installed</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Reported</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...sitePlugins]
                  .sort((a, b) => {
                    if (a.isManaged !== b.isManaged) return a.isManaged ? -1 : 1;
                    return a.pluginName.localeCompare(b.pluginName);
                  })
                  .map((sp) => {
                    const avail = sp.availableVersion || sp.installedVersion;
                    const differs = avail !== sp.installedVersion;

                    return (
                      <TableRow key={sp.id} className="h-12">
                        <TableCell>
                          <div className="font-medium">{sp.pluginName}</div>
                          <code className="text-xs text-muted-foreground">{sp.pluginSlug}</code>
                        </TableCell>
                        <TableCell>{sp.installedVersion}</TableCell>
                        <TableCell>
                          {sp.isManaged ? (
                            <div className="flex items-center gap-2">
                              {sp.autoSync ? (
                                <Badge variant="outline">Auto</Badge>
                              ) : (
                                <span className={`text-sm ${differs ? "font-semibold text-blue-600 dark:text-blue-400" : ""}`}>
                                  v{avail}
                                </span>
                              )}
                              {differs && !sp.autoSync && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => handleBump(sp.id, sp.pluginSlug)}
                                  disabled={bumpingId === sp.id}
                                >
                                  <ArrowUp className="mr-1 h-3 w-3" />
                                  Bump
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">&mdash;</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={sp.isActive ? "success" : "subtle"}>
                            {sp.isActive ? "Active" : "Inactive"}
                          </Badge>
                          {sp.isManaged && (
                            <Badge variant="outline" className="ml-1">
                              Managed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(sp.lastReportedAt).toLocaleString()}</TableCell>
                        <TableCell>
                          {sp.isManaged && (
                            <DropdownMenu>
                              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                                <MoreHorizontal className="h-4 w-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleCommand("update", sp.pluginSlug)} disabled={busy === `update-${sp.pluginSlug}`}>
                                  <RefreshCw className="mr-2 h-4 w-4" /> Force Update
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    const v = prompt("Enter the version to roll back to:");
                                    if (v) handleCommand("rollback", sp.pluginSlug, v);
                                  }}
                                >
                                  <History className="mr-2 h-4 w-4" /> Rollback
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {availableToInstall.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available to Install</CardTitle>
            <CardDescription>Managed plugins not yet installed on this site.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plugin</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableToInstall.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{p.slug}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => handleCommand("install", p.slug)} disabled={busy === `install-${p.slug}`}>
                        <Download className="mr-2 h-4 w-4" /> Install
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Command History</CardTitle>
          <CardDescription>Recent commands sent to this site.</CardDescription>
        </CardHeader>
        <CardContent>
          {commandLog.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No commands sent yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Plugin</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commandLog.map((cmd) => {
                  const resultMsg = commandResultMessage(cmd);
                  const preview = truncateMessage(resultMsg, 72);

                  return (
                    <TableRow
                      key={cmd.id}
                      className={resultMsg ? "cursor-pointer" : undefined}
                      onClick={() => resultMsg && setSelectedCommand(cmd)}
                    >
                      <TableCell>
                        <Badge variant="outline">{cmd.type}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{cmd.pluginSlug || "\u2014"}</TableCell>
                      <TableCell>{cmd.targetVersion || (cmd.type === "refresh" || cmd.type === "purge_cache" ? "\u2014" : "Latest")}</TableCell>
                      <TableCell className="max-w-[280px] overflow-hidden whitespace-normal">
                        <div className="flex items-center gap-1.5">
                          {statusIcon(cmd.status)}
                          <span className="text-sm">{formatStatus(cmd.status)}</span>
                        </div>
                        {preview && (
                          <div className="text-xs text-muted-foreground mt-0.5 truncate" title="View full result">
                            {preview}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(cmd.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{cmd.completedAt ? new Date(cmd.completedAt).toLocaleString() : "\u2014"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedCommand} onOpenChange={(open) => !open && setSelectedCommand(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Command details</DialogTitle>
            <DialogDescription className="break-words">
              {selectedCommand ? [selectedCommand.type, selectedCommand.pluginSlug].filter(Boolean).join(" ") : ""}
            </DialogDescription>
          </DialogHeader>
          {selectedCommand && (
            <div className="min-w-0 space-y-3 text-sm">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
                <span className="text-muted-foreground">Status</span>
                <span className="min-w-0 break-words">{formatStatus(selectedCommand.status)}</span>
                <span className="text-muted-foreground">Target</span>
                <span className="min-w-0 break-words">{selectedCommand.targetVersion || (selectedCommand.type === "refresh" || selectedCommand.type === "purge_cache" ? "\u2014" : "Latest")}</span>
                <span className="text-muted-foreground">Created</span>
                <span className="min-w-0 break-words">{new Date(selectedCommand.createdAt).toLocaleString()}</span>
                <span className="text-muted-foreground">Completed</span>
                <span className="min-w-0 break-words">{selectedCommand.completedAt ? new Date(selectedCommand.completedAt).toLocaleString() : "\u2014"}</span>
              </div>
              <div className="min-w-0">
                <div className="text-muted-foreground mb-1">Result</div>
                <pre className="max-h-64 max-w-full min-w-0 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">
                  {commandResultMessage(selectedCommand) || "No result reported."}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Permanently delete this site and all its associated data.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleDeleteSite} disabled={deleting}>
            <Trash2 className="mr-2 h-4 w-4" />
            {deleting ? "Deleting..." : "Delete Site"}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}

function commandResultMessage(cmd: CommandEntry): string {
  if (!cmd.result) return "";
  try {
    const parsed = JSON.parse(cmd.result) as { message?: string };
    return parsed.message || "";
  } catch {
    return cmd.result;
  }
}

function truncateMessage(message: string, maxLength: number): string {
  if (!message) return "";
  if (message.length <= maxLength) return message;
  return `${message.slice(0, maxLength - 1)}…`;
}
