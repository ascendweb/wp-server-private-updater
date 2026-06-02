import Link from "next/link";
import { prisma } from "@/lib/db";
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

export default async function SitesPage() {
  const sites = await prisma.site.findMany({
    include: {
      _count: { select: { licenses: true, plugins: true, commands: true } },
      plugins: {
        where: { pluginId: { not: null } },
        include: { plugin: { select: { name: true } } },
        orderBy: { pluginName: "asc" },
      },
      licenses: {
        where: { status: "active" },
        orderBy: { lastCheckAt: { sort: "desc", nulls: "last" } },
        take: 1,
        select: { lastCheckAt: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

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
          {sites.length === 0 ? (
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
                  <TableHead>Token</TableHead>
                  <TableHead>Last Check-in</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((site) => {
                  const lastCheck = site.licenses[0]?.lastCheckAt;
                  const pluginNames = site.plugins
                    .map((sp) => sp.plugin?.name || sp.pluginName || sp.pluginSlug)
                    .filter(Boolean);

                  return (
                    <TableRow key={site.id}>
                      <TableCell>
                        <Link
                          href={`/sites/${site.id}`}
                          className="font-medium hover:underline"
                        >
                          {site.url}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {pluginNames.length > 0 ? (
                            pluginNames.map((name) => (
                              <Badge key={name} variant="outline">
                                {name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {site._count.plugins > 0
                                ? `${site._count.plugins} plugins`
                                : "Awaiting heartbeat"}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{site._count.licenses}</TableCell>
                      <TableCell>
                        <Badge variant={site.siteToken ? "default" : "secondary"}>
                          {site.siteToken ? "Active" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {lastCheck
                          ? new Date(lastCheck).toLocaleString()
                          : "Never"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
