import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPluginRollout } from "@/lib/plugin-rollout";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const rollout = await getPluginRollout(id);
  if (!rollout) {
    return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
  }

  return NextResponse.json(rollout);
}
