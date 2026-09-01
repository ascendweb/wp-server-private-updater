"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  RotateCw,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  ArrowUp,
} from "lucide-react";
import { toast } from "sonner";
import { dispatchPluginCommands, setSitesAutoSync } from "./actions";

type BulkCommandType = "update" | "activate" | "deactivate";

interface PluginInfo {
  id: string;
  slug: string;
  name: string;
  githubOwner: string;
  githubRepo: string;
}

export interface LatestCommand {
  id: string;
  siteId?: string;
  type: string;
  pluginSlug: string;
  targetVersion: string | null;
  status: string;
  result: string | null;
  createdAt: string;
  completedAt: string | null;
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
  latestCommand: LatestCommand | null;
}

const INFLIGHT_STATUSES = new Set(["pending", "delivered", "in_progress"]);

export function PluginDetailClient({ plugin, sitePlugins }: { plugin: PluginInfo; sitePlugins: SitePluginEntry[] }) {
  const [rows, setRows] = useState(sitePlugins);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [loadingVersion, setLoadingVersion] = useState(true);
  const [refreshingVersion, setRefreshingVersion] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [pollKey, setPollKey] = useState(0);
  const [selectedCommand, setSelectedCommand] = useState<LatestCommand | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const lastClickedIndex = useRef<number | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRows(sitePlugins);
  }, [sitePlugins]);

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

  useEffect(() => {
    const el = headerCheckboxRef.current;
    if (el) {
      el.indeterminate = selected.size > 0 && selected.size < rows.length;
    }
  }, [selected, rows.length]);

  useEffect(() => {
    if (!selectedCommand) return;
    const next = rows.find((row) => row.latestCommand?.id === selectedCommand.id)?.latestCommand;
    if (
      next &&
      (next.status !== selectedCommand.status ||
        next.result !== selectedCommand.result ||
        next.completedAt !== selectedCommand.completedAt)
    ) {
      setSelectedCommand(next);
    }
  }, [rows, selectedCommand]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch(`/api/v1/plugins/${plugin.id}/rollout`);
        if (res.ok) {
          const data = (await res.json()) as { sites: SitePluginEntry[] };
          if (!cancelled && Array.isArray(data.sites)) {
            setRows(data.sites);
            const inflight = data.sites.some(
              (sp) => sp.latestCommand && INFLIGHT_STATUSES.has(sp.latestCommand.status)
            );
            if (inflight) {
              timer = setTimeout(poll, 2000);
            }
          }
        }
      } catch {
        if (!cancelled) {
          timer = setTimeout(poll, 8000);
        }
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [plugin.id, pollKey]);

  function kickPoll() {
    setPollKey((key) => key + 1);
  }

  async function refreshLatestVersion() {
    setRefreshingVersion(true);
    try {
      const res = await fetch(`/api/v1/releases/${plugin.slug}?refresh=1`);
      if (!res.ok) {
        toast.error("Failed to refresh latest version");
        return;
      }
      const release = await res.json();
      setLatestVersion(release.version || null);
      toast.success("Latest version refreshed");
    } catch {
      toast.error("Failed to refresh latest version");
    } finally {
      setRefreshingVersion(false);
    }
  }

  function applyRowSelection(event: React.MouseEvent, index: number, siteId: string) {
    event.preventDefault();
    const ids = rows.map((row) => row.siteId);

    if (event.shiftKey && lastClickedIndex.current != null) {
      const start = Math.min(lastClickedIndex.current, index);
      const end = Math.max(lastClickedIndex.current, index);
      setSelected((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          next.add(ids[i]);
        }
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(siteId)) next.delete(siteId);
        else next.add(siteId);
        return next;
      });
    }

    lastClickedIndex.current = index;
  }

  function toggleSelectAll() {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((row) => row.siteId)));
    }
  }

  async function bumpSites(siteIds: string[]) {
    const res = await fetch(`/api/v1/plugins/${plugin.id}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteIds }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Bump failed");
    }
    const data = await res.json();
    return data.version as string;
  }

  async function handleBumpSelected() {
    const siteIds = [...selected];
    if (siteIds.length === 0) return;
    setBulkBusy("bump");
    try {
      const version = await bumpSites(siteIds);
      toast.success(`Bumped v${version} to ${siteIds.length} site${siteIds.length === 1 ? "" : "s"}`);
      kickPoll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bump failed");
    }
    setBulkBusy(null);
  }

  async function handleBulkCommand(type: BulkCommandType) {
    const siteIds = [...selected];
    if (siteIds.length === 0) return;
    setBulkBusy(type);
    try {
      const result = await dispatchPluginCommands(plugin.id, siteIds, type);
      toast.success(`${labelForType(type)} sent to ${result.dispatched} site${result.dispatched === 1 ? "" : "s"}`);
      kickPoll();
    } catch {
      toast.error(`Failed to ${type} selected sites`);
    }
    setBulkBusy(null);
  }

  async function handleBulkAutoSync(autoSync: boolean) {
    const siteIds = [...selected];
    if (siteIds.length === 0) return;
    setBulkBusy(autoSync ? "auto-on" : "auto-off");
    try {
      await setSitesAutoSync(plugin.id, siteIds, autoSync);
      toast.success(autoSync ? "Auto-sync enabled" : "Auto-sync disabled");
      kickPoll();
    } catch {
      toast.error("Failed to update auto-sync");
    }
    setBulkBusy(null);
  }

  async function handleRowBump(siteId: string) {
    setRowBusy(`bump-${siteId}`);
    try {
      const version = await bumpSites([siteId]);
      toast.success(`Bumped to v${version}`);
      kickPoll();
    } catch {
      toast.error("Bump failed");
    }
    setRowBusy(null);
  }

  async function handleRowUpdate(siteId: string) {
    setRowBusy(`update-${siteId}`);
    try {
      await dispatchPluginCommands(plugin.id, [siteId], "update");
      toast.success("Update command sent");
      kickPoll();
    } catch {
      toast.error("Failed to send update");
    }
    setRowBusy(null);
  }

  async function handleRowAutoSync(siteId: string, autoSync: boolean) {
    setRowBusy(`sync-${siteId}`);
    try {
      await setSitesAutoSync(plugin.id, [siteId], autoSync);
      toast.success(autoSync ? "Auto-sync enabled" : "Auto-sync disabled");
      kickPoll();
    } catch {
      toast.error("Failed to toggle auto-sync");
    }
    setRowBusy(null);
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
        kickPoll();
      } else {
        toast.error("Failed to update version");
      }
    } catch {
      toast.error("Failed to update version");
    }
    setEditingId(null);
  }

  function isNewer(a: string, b: string): boolean {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const x = pa[i] || 0,
        y = pb[i] || 0;
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

  const allSelected = rows.length > 0 && selected.size === rows.length;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Latest Release</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-3xl font-bold">{loadingVersion ? "..." : latestVersion ? `v${latestVersion}` : "N/A"}</div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={refreshLatestVersion}
                disabled={refreshingVersion || loadingVersion}
              >
                <RotateCw className={`h-3.5 w-3.5 ${refreshingVersion ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sites</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{rows.length}</div>
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
        <CardHeader>
          <CardTitle>Version Rollout</CardTitle>
          <CardDescription>
            Select sites to bump, update, activate, or change auto-sync. Each site stays frozen at its installed version until you bump it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No sites have this plugin installed yet. Sites will appear here after they report their plugin inventory via heartbeat.
            </p>
          ) : (
            <>
              {selected.size > 0 && (
                <div className="sticky top-0 z-10 mb-3 flex items-center gap-3 rounded-lg border bg-background px-3 py-2">
                  <span className="text-sm font-medium">
                    ({selected.size}) {selected.size === 1 ? "site" : "sites"}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleBulkCommand("activate")} disabled={!!bulkBusy}>
                      Activate
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleBulkCommand("deactivate")} disabled={!!bulkBusy}>
                      Deactivate
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleBumpSelected} disabled={!!bulkBusy || !latestVersion}>
                      Bump
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => handleBulkCommand("update")}
                      disabled={!!bulkBusy}
                    >
                      Update
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />} disabled={!!bulkBusy}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleBulkAutoSync(true)}>Enable auto-sync</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkAutoSync(false)}>Disable auto-sync</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )}

              <div className="select-none">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        ref={headerCheckboxRef}
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all sites"
                      />
                    </TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Installed</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((sp, index) => {
                    const avail = sp.availableVersion || sp.installedVersion;
                    const availDiffersFromInstalled = avail !== sp.installedVersion;
                    const bumpable = canBump(sp);
                    const cmd = sp.latestCommand;
                    const resultMsg = cmd ? commandResultMessage(cmd) : "";
                    const preview = truncateMessage(resultMsg, 48);

                    return (
                      <TableRow
                        key={sp.id}
                        className="h-12"
                        onClick={(event) => {
                          const target = event.target as HTMLElement;
                          if (target.closest("a, button, input, [data-slot=dropdown-menu-trigger]")) return;
                          if (event.shiftKey || event.metaKey || event.ctrlKey) {
                            applyRowSelection(event, index, sp.siteId);
                          }
                        }}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={selected.has(sp.siteId)}
                            onClick={(event) => applyRowSelection(event, index, sp.siteId)}
                            onChange={() => {}}
                            aria-label={`Select ${sp.siteUrl}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Link href={`/sites/${sp.siteId}`} className="font-medium hover:underline">
                            {sp.siteUrl}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={sp.isActive ? "success" : "subtle"}>{sp.isActive ? "Active" : "Inactive"}</Badge>
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
                                title="Bump To Latest"
                                className="group h-6 px-2 text-xs bg-muted/30"
                                onClick={() => handleRowBump(sp.siteId)}
                                disabled={rowBusy === `bump-${sp.siteId}`}
                              >
                                <ArrowUp className="mr-1 h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[220px] overflow-hidden whitespace-normal">
                          {cmd ? (
                            <button
                              type="button"
                              className="w-full text-left cursor-pointer"
                              onClick={() => setSelectedCommand(cmd)}
                            >
                              <div className="flex items-center gap-1.5">
                                {statusIcon(cmd.status)}
                                <span className="text-sm">{formatStatus(cmd.status)}</span>
                              </div>
                              {preview && (
                                <div className="text-xs text-muted-foreground mt-0.5 truncate" title="View full result">
                                  {preview}
                                </div>
                              )}
                            </button>
                          ) : (
                            <span className="text-sm text-muted-foreground">{"\u2014"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleRowAutoSync(sp.siteId, !sp.autoSync)}
                                disabled={rowBusy === `sync-${sp.siteId}`}
                              >
                                {sp.autoSync ? "Disable auto-sync" : "Enable auto-sync"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleRowUpdate(sp.siteId)}
                                disabled={rowBusy === `update-${sp.siteId}`}
                              >
                                <RefreshCw className="mr-2 h-4 w-4" /> Update
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleRowBump(sp.siteId)}
                                disabled={rowBusy === `bump-${sp.siteId}` || sp.autoSync}
                              >
                                <ArrowUp className="mr-2 h-4 w-4" /> Bump
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedCommand} onOpenChange={(open) => !open && setSelectedCommand(null)}>
        <DialogContent className="sm:max-w-lg grid-cols-[minmax(0,1fr)]">
          <DialogHeader>
            <DialogTitle>Command details</DialogTitle>
            <DialogDescription className="break-words">
              {selectedCommand ? `${selectedCommand.type} ${selectedCommand.pluginSlug}` : ""}
            </DialogDescription>
          </DialogHeader>
          {selectedCommand && (
            <div className="min-w-0 space-y-3 text-sm">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
                <span className="text-muted-foreground">Status</span>
                <span className="min-w-0 break-words">{selectedCommand.status}</span>
                <span className="text-muted-foreground">Target</span>
                <span className="min-w-0 break-words">{selectedCommand.targetVersion || "Latest"}</span>
                <span className="text-muted-foreground">Created</span>
                <span className="min-w-0 break-words">{new Date(selectedCommand.createdAt).toLocaleString()}</span>
                <span className="text-muted-foreground">Completed</span>
                <span className="min-w-0 break-words">
                  {selectedCommand.completedAt ? new Date(selectedCommand.completedAt).toLocaleString() : "\u2014"}
                </span>
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
    </>
  );
}

function labelForType(type: string) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function statusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
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

function commandResultMessage(cmd: LatestCommand): string {
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
