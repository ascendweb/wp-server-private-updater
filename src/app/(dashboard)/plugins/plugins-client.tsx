"use client";

import { useState } from "react";
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
  DialogTrigger,
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
import { Plus, MoreHorizontal, Pencil, Trash2, GitBranch } from "lucide-react";
import { toast } from "sonner";

interface Plugin {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  githubOwner: string;
  githubRepo: string;
  testedWp: string | null;
  requiresPhp: string | null;
  createdAt: Date;
  _count: { licenses: number };
}

export function PluginsClient({ initialPlugins }: { initialPlugins: Plugin[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editPlugin, setEditPlugin] = useState<Plugin | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const data = {
      slug: fd.get("slug"),
      name: fd.get("name"),
      description: fd.get("description") || null,
      githubOwner: fd.get("githubOwner"),
      githubRepo: fd.get("githubRepo"),
      testedWp: fd.get("testedWp") || "6.7",
      requiresPhp: fd.get("requiresPhp") || "8.0",
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
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Plugins</h1>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setEditPlugin(null);
          }}
        >
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" /> Add Plugin
          </DialogTrigger>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="githubOwner">GitHub Owner</Label>
                  <Input
                    id="githubOwner"
                    name="githubOwner"
                    placeholder="octocat"
                    defaultValue={editPlugin?.githubOwner}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="githubRepo">GitHub Repo</Label>
                  <Input
                    id="githubRepo"
                    name="githubRepo"
                    placeholder="my-wp-plugin"
                    defaultValue={editPlugin?.githubRepo}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="testedWp">Tested WP Version</Label>
                  <Input
                    id="testedWp"
                    name="testedWp"
                    placeholder="6.7"
                    defaultValue={editPlugin?.testedWp || "6.7"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="requiresPhp">Requires PHP</Label>
                  <Input
                    id="requiresPhp"
                    name="requiresPhp"
                    placeholder="8.0"
                    defaultValue={editPlugin?.requiresPhp || "8.0"}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : editPlugin ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
                  <TableHead>GitHub</TableHead>
                  <TableHead>Licenses</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialPlugins.map((plugin) => (
                  <TableRow key={plugin.id}>
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
                      <a
                        href={`https://github.com/${plugin.githubOwner}/${plugin.githubRepo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                      >
                        <GitBranch className="h-3.5 w-3.5" />
                        {plugin.githubOwner}/{plugin.githubRepo}
                      </a>
                    </TableCell>
                    <TableCell>{plugin._count.licenses}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditPlugin(plugin);
                              setOpen(true);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(plugin.id)}
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
