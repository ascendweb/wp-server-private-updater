"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Ban, Trash2, CheckCircle, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { usePageHeader } from "@/components/page-header";

interface License {
  id: string;
  key: string;
  siteUrl: string;
  label: string | null;
  status: string;
  lastCheckAt: Date | null;
  createdAt: Date;
}

export function LicensesClient({ initialLicenses }: { initialLicenses: License[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  usePageHeader(
    "Licenses",
    <Button onClick={() => setOpen(true)}>
      <Plus className="mr-2 h-4 w-4" /> Create License
    </Button>,
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const data = {
      siteUrl: fd.get("siteUrl"),
      label: fd.get("label") || null,
    };

    const res = await fetch("/api/v1/licenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const license = await res.json();
      toast.success(`License created: ${license.key}`);
      setOpen(false);
      router.refresh();
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to create license");
    }
    setLoading(false);
  }

  async function handleRevoke(id: string) {
    const res = await fetch(`/api/v1/licenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "revoked" }),
    });
    if (res.ok) {
      toast.success("License revoked");
      router.refresh();
    }
  }

  async function handleActivate(id: string) {
    const res = await fetch(`/api/v1/licenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    if (res.ok) {
      toast.success("License activated");
      router.refresh();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Permanently delete this license?")) return;
    const res = await fetch(`/api/v1/licenses/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("License deleted");
      router.refresh();
    }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    toast.success("License key copied");
  }

  return (
    <div className="space-y-6">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create License</DialogTitle>
            <DialogDescription>Generate a new license key for a WordPress site.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="siteUrl">Site URL</Label>
              <Input id="siteUrl" name="siteUrl" placeholder="https://example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">Label (optional)</Label>
              <Input id="label" name="label" placeholder="Client name or note" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>License Keys</CardTitle>
          <CardDescription>Manage license keys that authorize WordPress sites to receive updates. Each license grants access to all plugins.</CardDescription>
        </CardHeader>
        <CardContent>
          {initialLicenses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No licenses created yet. Create one to authorize a site.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Check-in</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialLicenses.map((license) => (
                  <TableRow key={license.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{license.key.slice(0, 12)}...</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyKey(license.key)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      {license.label && !license.label.startsWith("Auto-connected:") && <div className="text-xs text-muted-foreground mt-1">{license.label}</div>}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="flex items-center gap-1.5">
                        {license.siteUrl}
                        {license.label?.startsWith("Auto-connected:") && (
                          <span title="Auto-connected">
                            <Link2 className="h-3.5 w-3.5 text-blue-500" />
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={license.status === "active" ? "success" : "error"}>
                        {license.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{license.lastCheckAt ? new Date(license.lastCheckAt).toLocaleDateString() : "Never"}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {license.status === "active" ? (
                            <DropdownMenuItem onClick={() => handleRevoke(license.id)}>
                              <Ban className="mr-2 h-4 w-4" /> Revoke
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleActivate(license.id)}>
                              <CheckCircle className="mr-2 h-4 w-4" /> Activate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(license.id)}>
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
