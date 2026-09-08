"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, RotateCw, Eraser } from "lucide-react";
import { toast } from "sonner";
import { usePageHeader } from "@/components/page-header";
import { sendSiteCommand } from "./actions";
import { formatSiteHost } from "@/lib/site-url";

interface SiteEntry {
  id: string;
  url: string;
  label: string | null;
  siteToken: string | null;
  pluginNames: string[];
  licenseCount: number;
  pluginCount: number;
  lastCheckAt: string | null;
  archivedAt: string | null;
}

export function SitesListClient({ archived }: { archived: boolean }) {
  const router = useRouter();
  const [sites, setSites] = useState<SiteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  usePageHeader(archived ? "Archived Sites" : "Sites");

  async function handleSiteCommand(siteId: string, type: "refresh" | "purge_cache") {
    const key = `${type}-${siteId}`;
    setBusy(key);
    try {
      await sendSiteCommand(siteId, type);
      toast.success(type === "refresh" ? "Refresh inventory command sent" : "Purge caches command sent");
    } catch {
      toast.error(type === "refresh" ? "Failed to send refresh" : "Failed to send cache purge");
    }
    setBusy(null);
  }

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/v1/sites${archived ? "?archived=true" : ""}`);
      if (res.ok) {
        setSites(await res.json());
      }
      setLoading(false);
    }
    load();
  }, [archived]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{archived ? "Archived Sites" : "Sites"}</CardTitle>
          <CardDescription>
            {archived
              ? "Historical records of archived WordPress sites. Licenses for these sites are not valid until restored."
              : "WordPress sites connected to the update server. Click a site to manage its plugins."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
          ) : sites.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {archived
                ? "No archived sites."
                : "No connected sites yet. Sites appear here once a license is created and checked in."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Plugins</TableHead>
                  <TableHead>Licenses</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>{archived ? "Archived" : "Last Check-in"}</TableHead>
                  {!archived && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((site) => (
                  <TableRow key={site.id} className="cursor-pointer" onClick={() => router.push(`/sites/${site.id}`)}>
                    <TableCell className="font-medium">{formatSiteHost(site.url)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{site.pluginCount > 0 ? site.pluginCount : "—"}</TableCell>
                    <TableCell>{site.licenseCount}</TableCell>
                    <TableCell>
                      {archived ? (
                        <Badge variant="subtle">Archived</Badge>
                      ) : (
                        <Badge variant={site.licenseCount > 0 ? "success" : "subtle"}>
                          {site.licenseCount > 0 ? "Active" : "No license"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {archived
                        ? site.archivedAt
                          ? new Date(site.archivedAt).toLocaleString()
                          : "—"
                        : site.lastCheckAt
                          ? new Date(site.lastCheckAt).toLocaleString()
                          : "Never"}
                    </TableCell>
                    {!archived && (
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-48">
                            <DropdownMenuItem
                              className="whitespace-nowrap"
                              onClick={() => handleSiteCommand(site.id, "refresh")}
                              disabled={busy === `refresh-${site.id}`}
                            >
                              <RotateCw />
                              Refresh inventory
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="whitespace-nowrap"
                              onClick={() => handleSiteCommand(site.id, "purge_cache")}
                              disabled={busy === `purge_cache-${site.id}`}
                            >
                              <Eraser />
                              Purge caches
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {archived ? (
        <p className="text-center">
          <Link href="/sites" className="text-sm text-muted-foreground hover:underline">
            Back to sites
          </Link>
        </p>
      ) : (
        <p className="text-center">
          <Link href="/sites/archived" className="text-sm text-muted-foreground hover:underline">
            View archived sites
          </Link>
        </p>
      )}
    </div>
  );
}
