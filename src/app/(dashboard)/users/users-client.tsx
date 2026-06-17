"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  Ban,
  Trash2,
  CheckCircle,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { usePageHeader } from "@/components/page-header";

interface AccountInfo {
  id: string;
  provider: string;
  createdAt: Date;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: Date;
  accounts: AccountInfo[];
}

export function UsersClient({ initialUsers }: { initialUsers: User[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  usePageHeader(
    "Users",
    <Button onClick={() => setCreateOpen(true)}>
      <Plus className="mr-2 h-4 w-4" /> Create User
    </Button>
  );

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    const res = await fetch("/api/v1/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: fd.get("email"),
        password: fd.get("password"),
        name: fd.get("name") || null,
      }),
    });

    if (res.ok) {
      toast.success("User created");
      setCreateOpen(false);
      router.refresh();
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to create user");
    }
    setLoading(false);
  }

  async function handleDisable(id: string) {
    const res = await fetch(`/api/v1/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "disabled" }),
    });
    if (res.ok) {
      toast.success("User disabled");
      router.refresh();
    }
  }

  async function handleEnable(id: string) {
    const res = await fetch(`/api/v1/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    if (res.ok) {
      toast.success("User enabled");
      router.refresh();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Permanently delete this user?")) return;
    const res = await fetch(`/api/v1/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("User deleted");
      router.refresh();
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to delete user");
    }
  }

  async function handleResetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!resetUserId) return;
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    const res = await fetch(`/api/v1/users/${resetUserId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: fd.get("password") }),
    });

    if (res.ok) {
      toast.success("Password updated");
      setResetOpen(false);
      setResetUserId(null);
    } else {
      toast.error("Failed to update password");
    }
    setLoading(false);
  }

  function openResetDialog(id: string) {
    setResetUserId(id);
    setResetOpen(true);
  }

  const providerLabel: Record<string, string> = {
    credentials: "Email",
    github: "GitHub",
    google: "Google",
  };

  return (
    <div className="space-y-6">
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
            <DialogHeader>
              <DialogTitle>Create User</DialogTitle>
              <DialogDescription>
                Add a new user with email and password credentials.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name (optional)</Label>
                <Input id="name" name="name" placeholder="Jane Smith" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                />
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
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Manage users who can access the admin dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {initialUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No users found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Auth Methods</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="text-sm font-medium">
                      {user.name || <span className="text-muted-foreground">--</span>}
                    </TableCell>
                    <TableCell className="text-sm">{user.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.accounts.map((a) => (
                          <Badge key={a.id} variant="outline">
                            {providerLabel[a.provider] ?? a.provider}
                          </Badge>
                        ))}
                        {user.accounts.length === 0 && (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{user.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.status === "active" ? "default" : "destructive"}
                      >
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon" className="h-8 w-8" />
                          }
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {user.status === "active" ? (
                            <DropdownMenuItem onClick={() => handleDisable(user.id)}>
                              <Ban className="mr-2 h-4 w-4" /> Disable
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleEnable(user.id)}>
                              <CheckCircle className="mr-2 h-4 w-4" /> Enable
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => openResetDialog(user.id)}
                          >
                            <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(user.id)}
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

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for this user.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-password">New Password</Label>
              <Input
                id="reset-password"
                name="password"
                type="password"
                required
                minLength={8}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Update Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
