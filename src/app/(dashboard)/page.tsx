import Link from "next/link";
import { prisma } from "@/lib/db";
import { SetPageHeader } from "@/components/set-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Puzzle, KeyRound, Globe, Activity, Terminal, Shield } from "lucide-react";

export default async function DashboardPage() {
  const [pluginCount, activeLicenses, recentCheckins, siteCount, sitesWithToken, recentCommands] = await Promise.all([
    prisma.plugin.count(),
    prisma.license.count({ where: { status: "active" } }),
    prisma.license.count({
      where: {
        lastCheckAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.site.count(),
    prisma.site.count({ where: { siteToken: { not: null } } }),
    prisma.command.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { site: { select: { url: true, id: true } } },
    }),
  ]);

  const stats = [
    { title: "Plugins", value: pluginCount, icon: Puzzle },
    { title: "Active Licenses", value: activeLicenses, icon: KeyRound },
    { title: "Connected Sites", value: siteCount, icon: Globe },
    { title: "Check-ins (24h)", value: recentCheckins, icon: Activity },
    { title: "Sites with Token", value: `${sitesWithToken}/${siteCount}`, icon: Shield },
    { title: "Commands (total)", value: recentCommands.length > 0 ? "See below" : "0", icon: Terminal },
  ];

  return (
    <div className="space-y-6">
      <SetPageHeader title="Dashboard" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.slice(0, 5).map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Commands</CardTitle>
          <CardDescription>Latest commands dispatched to connected sites.</CardDescription>
        </CardHeader>
        <CardContent>
          {recentCommands.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No commands dispatched yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Plugin</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCommands.map((cmd) => (
                  <TableRow key={cmd.id}>
                    <TableCell>
                      <Link href={`/sites/${cmd.site.id}`} className="text-sm hover:underline">
                        {cmd.site.url}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{cmd.type}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{cmd.pluginSlug}</TableCell>
                    <TableCell>
                      <Badge variant={cmd.status === "completed" ? "success" : cmd.status === "failed" ? "error" : "warn"}>
                        {cmd.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{cmd.createdAt.toLocaleString()}</TableCell>
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
