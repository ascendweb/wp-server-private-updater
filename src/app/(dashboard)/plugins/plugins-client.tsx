"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Plus, MoreHorizontal, Pencil, Trash2, GitBranch, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { usePageHeader } from "@/components/page-header";

interface Plugin {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  githubOwner: string;
  githubRepo: string;
  releaseAssetPattern: string;
  createdAt: Date;
  _count: { sitePlugins: number };
}

interface ReleaseInfo {
  version: string;
}

export function PluginsClient({ initialPlugins }: { initialPlugins: Plugin[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editPlugin, setEditPlugin] = useState<Plugin | null>(null);
  const [loading, setLoading] = useState(false);
  const [latestVersions, setLatestVersions] = useState<Record<string, string>>({});
  const [refreshingSlug, setRefreshingSlug] = useState<string | null>(null);

  usePageHeader(
    "Plugins",
    <Button onClick={() => setOpen(true)}>
      <Plus className="mr-2 h-4 w-4" /> Add Plugin
    </Button>
  );

  useEffect(() => {
    let cancelled = false;

    async function loadLatestVersions() {
      const entries = await Promise.all(
        initialPlugins.map(async (plugin) => {
          try {
            const res = await fetch(`/api/v1/releases/${plugin.slug}`);
            if (!res.ok) return [plugin.slug, "N/A"] as const;
            const release = (await res.json()) as ReleaseInfo;
            return [plugin.slug, release.version || "N/A"] as const;
          } catch {
            return [plugin.slug, "N/A"] as const;
          }
        })
      );

      if (!cancelled) {
        setLatestVersions(Object.fromEntries(entries));
      }
    }

    loadLatestVersions();

    return () => {
      cancelled = true;
    };
  }, [initialPlugins]);

  async function refreshLatestVersion(slug: string) {
    setRefreshingSlug(slug);
    try {
      const res = await fetch(`/api/v1/releases/${slug}?refresh=1`);
      if (!res.ok) {
        setLatestVersions((prev) => ({ ...prev, [slug]: "N/A" }));
        toast.error("Failed to refresh latest version");
        return;
      }

      const release = (await res.json()) as ReleaseInfo;
      setLatestVersions((prev) => ({ ...prev, [slug]: release.version || "N/A" }));
      toast.success("Latest version refreshed");
    } catch {
      setLatestVersions((prev) => ({ ...prev, [slug]: "N/A" }));
      toast.error("Failed to refresh latest version");
    } finally {
      setRefreshingSlug(null);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const data = {
      slug: fd.get("slug"),
      name: fd.get("name"),
      description: fd.get("description") || null,
      githubUrl: fd.get("githubUrl"),
      releaseAssetPattern:
        fd.get("releaseAssetPattern") || "{slug}-v{version}.zip",
    };

    const url = editPlugin
      ? `/api/v1/plugins/${editPlugin.id}`
      : "/api/v1/plugins";
    const method = editPlugin ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      toast.success(editPlugin ? "Plugin updated" : "Plugin created");
      setOpen(false);
      setEditPlugin(null);
      router.refresh();
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to save plugin");
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this plugin and all its licenses?")) return;
    const res = await fetch(`/api/v1/plugins/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Plugin deleted");
      router.refresh();
    } else {
      toast.error("Failed to delete plugin");
    }
  }

  return (
    <div className="space-y-6">
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditPlugin(null);
        }}
      >
        <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editPlugin ? "Edit Plugin" : "Add Plugin"}
              </DialogTitle>
              <DialogDescription>
                {editPlugin
                  ? "Update the plugin configuration."
                  : "Register a new plugin from a GitHub repository."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    name="slug"
                    placeholder="my-plugin"
                    defaultValue={editPlugin?.slug}
                    required
                    disabled={!!editPlugin}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="My Plugin"
                    defaultValue={editPlugin?.name}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Optional description"
                  defaultValue={editPlugin?.description || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="githubUrl">GitHub Repository URL</Label>
                <Input
                  id="githubUrl"
                  name="githubUrl"
                  placeholder="https://github.com/octocat/my-wp-plugin"
                  defaultValue={
                    editPlugin
                      ? `https://github.com/${editPlugin.githubOwner}/${editPlugin.githubRepo}`
                      : ""
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="releaseAssetPattern">Release Asset Pattern</Label>
                <Input
                  id="releaseAssetPattern"
                  name="releaseAssetPattern"
                  placeholder="{slug}-v{version}.zip"
                  defaultValue={editPlugin?.releaseAssetPattern || "{slug}-v{version}.zip"}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : editPlugin ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Registered Plugins</CardTitle>
          <CardDescription>
            Plugins mapped to GitHub repositories for update distribution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {initialPlugins.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No plugins registered yet. Add your first plugin to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plugin</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Latest</TableHead>
                  <TableHead>GitHub</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialPlugins.map((plugin) => (
                  <TableRow
                    key={plugin.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/plugins/${plugin.id}`)}
                  >
                    <TableCell>
                      <div className="font-medium">{plugin.name}</div>
                      {plugin.description && (
                        <div className="text-sm text-muted-foreground truncate max-w-xs">
                          {plugin.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{plugin.slug}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{latestVersions[plugin.slug] ?? "..."}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            refreshLatestVersion(plugin.slug);
                          }}
                          disabled={refreshingSlug === plugin.slug}
                        >
                          <RotateCw
                            className={`h-3.5 w-3.5 ${refreshingSlug === plugin.slug ? "animate-spin" : ""}`}
                          />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <a
                        href={`https://github.com/${plugin.githubOwner}/${plugin.githubRepo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <GitBranch className="h-3.5 w-3.5" />
                        {plugin.githubOwner}/{plugin.githubRepo}
                      </a>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon" className="h-8 w-8" />}
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditPlugin(plugin);
                              setOpen(true);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(plugin.id);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
