"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashClientSecret, MCP_READ_SCOPE, randomToken } from "@/lib/mcp/tokens";
import { revalidatePath } from "next/cache";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function listServiceClients() {
  await requireUserId();
  return prisma.mcpOAuthClient.findMany({
    where: { type: "service" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      clientId: true,
      name: true,
      createdAt: true,
    },
  });
}

export async function createServiceClient(name: string) {
  const userId = await requireUserId();
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: "Name is required" };
  }

  const clientId = `svc_${randomToken(18)}`;
  const clientSecret = randomToken(32);
  await prisma.mcpOAuthClient.create({
    data: {
      clientId,
      clientSecret: hashClientSecret(clientSecret),
      name: trimmed,
      type: "service",
      tokenEndpointAuthMethod: "client_secret_post",
      redirectUris: [],
      scopes: [MCP_READ_SCOPE],
      createdById: userId,
    },
  });
  revalidatePath("/settings");
  return { clientId, clientSecret };
}

export async function revokeServiceClient(id: string) {
  await requireUserId();
  await prisma.mcpOAuthClient.deleteMany({
    where: { id, type: "service" },
  });
  revalidatePath("/settings");
}
