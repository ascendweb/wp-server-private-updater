"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAndDispatch } from "@/lib/commands";
import type { CommandType } from "@prisma/client";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

const SITE_COMMAND_TYPES = new Set<CommandType>(["refresh", "purge_cache"]);

export async function sendSiteCommand(siteId: string, type: CommandType) {
  await requireAuth();
  if (!SITE_COMMAND_TYPES.has(type)) {
    throw new Error("Unsupported site command type");
  }
  await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
  return createAndDispatch(siteId, type, "");
}
