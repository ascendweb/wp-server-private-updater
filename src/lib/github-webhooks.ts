import type { EmitterWebhookEventName } from "@octokit/webhooks";
import { createGitHubApp } from "./github";
import { prisma } from "./db";
import { applyIncomingGitHubRelease, syncPluginLatestRelease } from "./plugin-release";

function createWebhookApp() {
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("GITHUB_APP_WEBHOOK_SECRET must be set");
  }
  return createGitHubApp(secret);
}

export async function receiveGitHubWebhook(args: {
  id: string;
  name: string;
  signature: string;
  payload: string;
}) {
  const app = createWebhookApp();

  app.webhooks.on(["release.published", "release.released", "release.edited"], async ({ payload }) => {
    const plugin = await prisma.plugin.findUnique({
      where: {
        githubOwner_githubRepo: {
          githubOwner: payload.repository.owner.login,
          githubRepo: payload.repository.name,
        },
      },
    });
    if (!plugin) return;

    await applyIncomingGitHubRelease(plugin, {
      tagName: payload.release.tag_name,
      changelog: payload.release.body || "",
      publishedAt: payload.release.published_at,
      prerelease: payload.release.prerelease,
      draft: payload.release.draft,
    });
  });

  app.webhooks.on(["release.unpublished", "release.deleted"], async ({ payload }) => {
    const plugin = await prisma.plugin.findUnique({
      where: {
        githubOwner_githubRepo: {
          githubOwner: payload.repository.owner.login,
          githubRepo: payload.repository.name,
        },
      },
    });
    if (!plugin) return;

    try {
      await syncPluginLatestRelease(plugin);
    } catch {
      // Leave the stored latest in place if GitHub is temporarily unavailable.
    }
  });

  await app.webhooks.verifyAndReceive({
    id: args.id,
    name: args.name as EmitterWebhookEventName,
    signature: args.signature,
    payload: args.payload,
  });
}
