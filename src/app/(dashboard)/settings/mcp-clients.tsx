"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createServiceClient, revokeServiceClient } from "./mcp-actions";
import { toast } from "sonner";

type ClientRow = {
  id: string;
  clientId: string;
  name: string;
  createdAt: Date;
};

export function McpServiceClients({ initialClients }: { initialClients: ClientRow[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [secretOpen, setSecretOpen] = useState(false);
  const [issued, setIssued] = useState<{ clientId: string; clientSecret: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const result = await createServiceClient(String(fd.get("name") || ""));
    setLoading(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    if ("clientId" in result && result.clientSecret) {
      setIssued({ clientId: result.clientId, clientSecret: result.clientSecret });
      setCreateOpen(false);
      setSecretOpen(true);
      router.refresh();
    }
  }

  async function handleRevoke(id: string) {
    await revokeServiceClient(id);
    toast.success("Client revoked");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>Create service client</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Client ID</TableHead>
            <TableHead>Created</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {initialClients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                No service clients yet. Create one for automations that cannot open a browser login.
              </TableCell>
            </TableRow>
          ) : (
            initialClients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>{client.name}</TableCell>
                <TableCell className="font-mono text-xs">{client.clientId}</TableCell>
                <TableCell>{new Date(client.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <Button variant="destructive" size="sm" onClick={() => handleRevoke(client.id)}>
                    Revoke
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Create service client</DialogTitle>
              <DialogDescription>
                For n8n, Gemini Enterprise, or other automations. Uses the client_credentials grant.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="n8n" required />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={secretOpen} onOpenChange={setSecretOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy the client secret now</DialogTitle>
            <DialogDescription>
              This secret is shown once. Store it in your automation; we only keep a hash.
            </DialogDescription>
          </DialogHeader>
          {issued && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Client ID</Label>
                <Input readOnly value={issued.clientId} />
              </div>
              <div className="space-y-1">
                <Label>Client secret</Label>
                <Input readOnly value={issued.clientSecret} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => {
                setSecretOpen(false);
                setIssued(null);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
