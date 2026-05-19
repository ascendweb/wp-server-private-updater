import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Puzzle, KeyRound, Globe, Activity } from "lucide-react";

export default async function DashboardPage() {
  const [pluginCount, activeLicenses, recentCheckins, uniqueSites] =
    await Promise.all([
      prisma.plugin.count(),
      prisma.license.count({ where: { status: "active" } }),
      prisma.license.count({
        where: {
          lastCheckAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.license.groupBy({
        by: ["siteUrl"],
        where: { status: "active" },
      }),
    ]);

  const stats = [
    { title: "Plugins", value: pluginCount, icon: Puzzle },
    { title: "Active Licenses", value: activeLicenses, icon: KeyRound },
    { title: "Connected Sites", value: uniqueSites.length, icon: Globe },
    { title: "Check-ins (24h)", value: recentCheckins, icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
