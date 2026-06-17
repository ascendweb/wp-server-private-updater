"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

interface SiteEntry {
  id: string;
  url: string;
  label: string | null;
  siteToken: string | null;
  pluginNames: string[];
  licenseCount: number;
  pluginCount: number;
  lastCheckAt: string | null;
}

export default function SitesPage() {
  const router = useRouter();
  const [sites, setSites] = useState<SiteEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/v1/sites");
      if (res.ok) {
        setSites(await res.json());
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Connected Sites</h1>
      <Card>
        <CardHeader>
          <CardTitle>Sites</CardTitle>
          <CardDescription>
            WordPress sites connected to the update server. Click a site to manage its plugins.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
          ) : sites.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No connected sites yet. Sites appear here once a license is created and checked in.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site URL</TableHead>
                  <TableHead>Plugins</TableHead>
                  <TableHead>Licenses</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Check-in</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((site) => (
                  <TableRow
                    key={site.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/sites/${site.id}`)}
                  >
                    <TableCell className="font-medium">{site.url}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {site.pluginNames.length > 0 ? (
                          site.pluginNames.map((name) => (
                            <Badge key={name} variant="outline">
                              {name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {site.pluginCount > 0
                              ? `${site.pluginCount} plugins`
                              : "Awaiting heartbeat"}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{site.licenseCount}</TableCell>
                    <TableCell>
                      <Badge variant={site.licenseCount > 0 ? "default" : "secondary"}>
                        {site.licenseCount > 0 ? "Active" : "No license"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {site.lastCheckAt
                        ? new Date(site.lastCheckAt).toLocaleString()
                        : "Never"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
