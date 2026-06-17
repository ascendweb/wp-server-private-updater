"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Lock } from "lucide-react";
import { toast } from "sonner";
import { forceUpdateSite, forceUpdateAll } from "./actions";

interface SiteEntry {
  siteId: string;
  siteUrl: string;
  siteLabel: string;
  hasToken: boolean;
  installedVersion: string;
  isActive: boolean;
  isLocked: boolean;
  lastReportedAt: string;
}

export function PluginSitesClient({ pluginSlug, sites }: { pluginSlug: string; sites: SiteEntry[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [updatingAll, setUpdatingAll] = useState(false);

  const unlockedCount = sites.filter((s) => !s.isLocked).length;

  async function handleUpdateSite(siteId: string) {
    setBusy(siteId);
    try {
      await forceUpdateSite(siteId, pluginSlug);
      router.refresh();
      toast.success("Update command sent");
    } catch {
      toast.error("Failed to send update command");
    }
    setBusy(null);
  }

  async function handleUpdateAll() {
    if (!confirm(`Send update command to ${unlockedCount} unlocked site(s)?`)) return;
    setUpdatingAll(true);
    try {
      const result = await forceUpdateAll(pluginSlug);
      router.refresh();
      toast.success(`Update commands sent to ${result.dispatched} sites`);
    } catch {
      toast.error("Failed to send bulk update");
    }
    setUpdatingAll(false);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Sites ({sites.length})</CardTitle>
          <CardDescription>
            {unlockedCount} unlocked, {sites.length - unlockedCount} locked
          </CardDescription>
        </div>
        {sites.length > 0 && (
          <Button onClick={handleUpdateAll} disabled={updatingAll || unlockedCount === 0}>
            <RefreshCw className={`mr-2 h-4 w-4 ${updatingAll ? "animate-spin" : ""}`} />
            Update All Unlocked
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {sites.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No sites have reported this plugin installed yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Last Reported</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.map((s) => (
                <TableRow key={s.siteId}>
                  <TableCell>
                    <Link href={`/sites/${s.siteId}`} className="font-medium hover:underline">
                      {s.siteUrl}
                    </Link>
                  </TableCell>
                  <TableCell>{s.installedVersion}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={s.isActive ? "success" : "subtle"}>
                        {s.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {s.isLocked && <Lock className="h-3.5 w-3.5 text-orange-500" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.hasToken ? "success" : "warn"}>
                      {s.hasToken ? "Active" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(s.lastReportedAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleUpdateSite(s.siteId)} disabled={busy === s.siteId || s.isLocked} title={s.isLocked ? "Site is version-locked" : "Force update"}>
                      <RefreshCw className={`h-4 w-4 ${busy === s.siteId ? "animate-spin" : ""}`} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
