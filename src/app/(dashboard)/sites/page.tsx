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
  const licenses = await prisma.license.findMany({
    where: { status: "active" },
    include: { plugin: { select: { name: true, slug: true } } },
    orderBy: { lastCheckAt: { sort: "desc", nulls: "last" } },
  });

  const siteMap = new Map<
    string,
    { plugins: string[]; lastCheckAt: Date | null; licenseCount: number }
  >();

  for (const lic of licenses) {
    const existing = siteMap.get(lic.siteUrl);
    const pluginName = lic.plugin?.name || "All plugins";
    if (existing) {
      existing.plugins.push(pluginName);
      existing.licenseCount++;
      if (lic.lastCheckAt && (!existing.lastCheckAt || lic.lastCheckAt > existing.lastCheckAt)) {
        existing.lastCheckAt = lic.lastCheckAt;
      }
    } else {
      siteMap.set(lic.siteUrl, {
        plugins: [pluginName],
        lastCheckAt: lic.lastCheckAt,
        licenseCount: 1,
      });
    }
  }

  const sites = Array.from(siteMap.entries()).map(([url, data]) => ({
    url,
    ...data,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Connected Sites</h1>
      <Card>
        <CardHeader>
          <CardTitle>Sites</CardTitle>
          <CardDescription>
            WordPress sites with active license keys, grouped by domain.
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
                  <TableHead>Last Check-in</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((site) => (
                  <TableRow key={site.url}>
                    <TableCell>
                      <a
                        href={site.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline"
                      >
                        {site.url}
                      </a>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {[...new Set(site.plugins)].map((p) => (
                          <Badge key={p} variant="outline">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{site.licenseCount}</TableCell>
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
