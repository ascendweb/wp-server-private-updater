import { NextRequest, NextResponse } from "next/server";
import { receiveGitHubWebhook } from "@/lib/github-webhooks";

export async function POST(req: NextRequest) {
  const id = req.headers.get("x-github-delivery");
  const name = req.headers.get("x-github-event");
  const signature = req.headers.get("x-hub-signature-256");
  const payload = await req.text();

  if (!id || !name || !signature) {
    return NextResponse.json({ error: "Missing GitHub webhook headers" }, { status: 400 });
  }

  try {
    await receiveGitHubWebhook({ id, name, signature, payload });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid webhook";
    const status = message.includes("GITHUB_APP_WEBHOOK_SECRET") ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
