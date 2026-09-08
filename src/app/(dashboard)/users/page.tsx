import { prisma } from "@/lib/db";
import { UsersClient } from "./users-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      accounts: { select: { id: true, provider: true, createdAt: true } },
    },
  });

  return <UsersClient initialUsers={users} />;
}
