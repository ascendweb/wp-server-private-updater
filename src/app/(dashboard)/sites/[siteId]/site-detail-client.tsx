"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Lock,
  Unlock,
  RefreshCw,
  Download,
  MoreHorizontal,
  History,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { toggleLock, sendCommand, deleteSite } from "./actions";

interface SitePlugin {
  id: string;
  pluginSlug: string;
  pluginName: string;
  installedVersion: string;
  isActive: boolean;
  isLocked: boolean;
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

export function SiteDetailClient({
  site,
  sitePlugins,
  commands,
  availableToInstall,
}: {
  site: SiteInfo;
  sitePlugins: SitePlugin[];
  commands: CommandEntry[];
  availableToInstall: AvailablePlugin[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleToggleLock(sitePluginId: string) {
    setBusy(sitePluginId);
    try {
      await toggleLock(sitePluginId);
      router.refresh();
      toast.success("Lock toggled");
    } catch {
      toast.error("Failed to toggle lock");
    }
    setBusy(null);
  }

  async function handleCommand(
    type: "update" | "install" | "rollback",
    pluginSlug: string,
    targetVersion?: string
  ) {
    const key = `${type}-${pluginSlug}`;
    setBusy(key);
    try {
      await sendCommand(site.id, type, pluginSlug, targetVersion || null);
      router.refresh();
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} command sent`);
    } catch {
      toast.error(`Failed to send ${type} command`);
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

  return (
    <>
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
            <Badge
              variant="outline"
              className={
                site.siteToken
                  ? "text-lg border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
                  : "text-lg border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400"
              }
            >
              {site.siteToken ? "Active" : "Pending"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Installed Plugins</CardTitle>
          <CardDescription>
            Plugins reported by this site&apos;s heartbeat. Managed plugins can be updated, locked, or rolled back.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sitePlugins.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No plugins reported yet. The site will report its plugin inventory on its next heartbeat.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plugin</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Locked</TableHead>
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
                  .map((sp) => (
                  <TableRow key={sp.id}>
                    <TableCell>
                      <div className="font-medium">{sp.pluginName}</div>
                      <code className="text-xs text-muted-foreground">{sp.pluginSlug}</code>
                    </TableCell>
                    <TableCell>{sp.installedVersion}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          sp.isActive
                            ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
                            : "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
                        }
                      >
                        {sp.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {sp.isManaged && (
                        <Badge variant="outline" className="ml-1">Managed</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {sp.isManaged ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleToggleLock(sp.id)}
                          disabled={busy === sp.id}
                          title={sp.isLocked ? "Unlock version" : "Lock at current version"}
                        >
                          {sp.isLocked ? (
                            <Lock className="h-4 w-4 text-orange-500" />
                          ) : (
                            <Unlock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(sp.lastReportedAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {sp.isManaged && (
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                              <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleCommand("update", sp.pluginSlug)}
                              disabled={busy === `update-${sp.pluginSlug}` || sp.isLocked}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" /> Force Update
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                const v = prompt("Enter the version to roll back to:");
                                if (v) handleCommand("rollback", sp.pluginSlug, v);
                              }}
                              disabled={sp.isLocked}
                            >
                              <History className="mr-2 h-4 w-4" /> Rollback
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {availableToInstall.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available to Install</CardTitle>
            <CardDescription>
              Managed plugins not yet installed on this site.
            </CardDescription>
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
                      <Button
                        size="sm"
                        onClick={() => handleCommand("install", p.slug)}
                        disabled={busy === `install-${p.slug}`}
                      >
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
          <CardDescription>
            Recent commands sent to this site.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {commands.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No commands sent yet.
            </p>
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
                {commands.map((cmd) => {
                  let resultMsg = "";
                  if (cmd.result) {
                    try {
                      const r = JSON.parse(cmd.result);
                      resultMsg = r.message || "";
                    } catch {
                      resultMsg = cmd.result;
                    }
                  }

                  return (
                    <TableRow key={cmd.id}>
                      <TableCell>
                        <Badge variant="outline">{cmd.type}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{cmd.pluginSlug}</TableCell>
                      <TableCell>{cmd.targetVersion || "Latest"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {statusIcon(cmd.status)}
                          <span className="text-sm">{cmd.status}</span>
                        </div>
                        {resultMsg && (
                          <div className="text-xs text-muted-foreground mt-0.5">{resultMsg}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(cmd.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {cmd.completedAt
                          ? new Date(cmd.completedAt).toLocaleString()
                          : "\u2014"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Permanently delete this site and all its associated data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={handleDeleteSite}
            disabled={deleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deleting ? "Deleting..." : "Delete Site"}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
