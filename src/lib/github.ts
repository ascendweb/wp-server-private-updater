import { App } from "octokit";
import { stripVersionPrefix } from "./plugin-version";

export type GitHubRelease = {
  version: string;
  changelog: string;
  publishedAt: string | null;
};

let appInstance: App | null = null;

export function parseGitHubRepoUrl(urlInput: string): { owner: string; repo: string } | null {
  const input = urlInput.trim();
  if (!input) return null;

  let normalized = input;
  if (normalized.startsWith("git@github.com:")) {
    normalized = `https://github.com/${normalized.replace("git@github.com:", "")}`;
  }

  try {
    const url = new URL(normalized);
    if (url.hostname !== "github.com") return null;

    const parts = url.pathname
      .replace(/^\/+|\/+$/g, "")
      .replace(/\.git$/, "")
      .split("/");

    if (parts.length < 2 || !parts[0] || !parts[1]) return null;

    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

export function isGitHubAppConfigured() {
  return Boolean(
    process.env.GITHUB_APP_ID &&
      process.env.GITHUB_APP_PRIVATE_KEY &&
      process.env.GITHUB_APP_INSTALLATION_ID
  );
}

function githubAppCredentials() {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error("GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be set");
  }
  if (!privateKey.includes("BEGIN")) {
    throw new Error(
      "GITHUB_APP_PRIVATE_KEY must be the full GitHub App PEM private key, not a fingerprint."
    );
  }

  return { appId, privateKey: privateKey.replace(/\\n/g, "\n") };
}

export function createGitHubApp(webhookSecret?: string) {
  const { appId, privateKey } = githubAppCredentials();
  return new App({
    appId,
    privateKey,
    ...(webhookSecret ? { webhooks: { secret: webhookSecret } } : {}),
  });
}

function getApp(): App {
  if (appInstance) return appInstance;
  appInstance = createGitHubApp();
  return appInstance;
}

async function getInstallationOctokit() {
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  if (!installationId) {
    throw new Error("GITHUB_APP_INSTALLATION_ID must be set");
  }
  return getApp().getInstallationOctokit(Number(installationId));
}

async function getInstallationToken(octokit: Awaited<ReturnType<typeof getInstallationOctokit>>) {
  const authResult = await octokit.auth({ type: "installation" });
  if (
    authResult &&
    typeof authResult === "object" &&
    "token" in authResult &&
    typeof authResult.token === "string"
  ) {
    return authResult.token;
  }
  return null;
}

function buildAssetNameCandidates(slug: string, version: string, pattern?: string | null): string[] {
  const normalizedVersion = version.replace(/^v/i, "");
  const chosenPattern = pattern?.trim() || "{slug}-v{version}.zip";
  const candidates = new Set<string>();

  candidates.add(
    chosenPattern
      .replaceAll("{slug}", slug)
      .replaceAll("{version}", normalizedVersion)
  );
  candidates.add(
    chosenPattern
      .replaceAll("{slug}", slug)
      .replaceAll("{version}", version)
  );

  return [...candidates].filter(Boolean);
}

export async function fetchLatestReleaseFromGitHub(owner: string, repo: string): Promise<GitHubRelease | null> {
  try {
    const octokit = await getInstallationOctokit();
    const { data } = await octokit.rest.repos.getLatestRelease({ owner, repo });

    return {
      version: stripVersionPrefix(data.tag_name),
      changelog: data.body || "",
      publishedAt: data.published_at || data.created_at,
    };
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 404) {
      return null;
    }
    throw err;
  }
}

export async function streamReleaseZip(
  owner: string,
  repo: string,
  slug: string,
  tag: string,
  releaseAssetPattern?: string | null
): Promise<{ stream: ReadableStream; contentType: string } | null> {
  const octokit = await getInstallationOctokit();
  const installationToken = await getInstallationToken(octokit);
  const refs = Array.from(new Set([tag, tag.replace(/^v/i, ""), `v${tag.replace(/^v/i, "")}`]));
  const assetCandidates = buildAssetNameCandidates(slug, tag, releaseAssetPattern);

  async function fetchReleaseAssetForRef(ref: string) {
    const { data: release } = await octokit.rest.repos.getReleaseByTag({
      owner,
      repo,
      tag: ref,
    });

    const asset = release.assets.find((item) => assetCandidates.includes(item.name));
    if (!asset) return null;

    const headers: Record<string, string> = {
      Accept: "application/octet-stream",
      "User-Agent": "wp-private-updater",
    };
    if (installationToken) {
      headers.Authorization = `Bearer ${installationToken}`;
    }

    const response = await fetch(asset.url, {
      headers,
      redirect: "follow",
    });

    if (!response.ok || !response.body) return null;

    return {
      stream: response.body,
      contentType: response.headers.get("content-type") || "application/zip",
    };
  }

  async function fetchZipForRef(ref: string) {
    const { url } = await octokit.rest.repos.downloadZipballArchive({
      owner,
      repo,
      ref,
      request: { redirect: "manual" },
    });

    const authHeaders = installationToken
      ? {
          Authorization: `Bearer ${installationToken}`,
          "User-Agent": "wp-private-updater",
        }
      : undefined;

    // Try authenticated fetch first for private repos, then unauthenticated fallback.
    let response = await fetch(url, {
      headers: authHeaders,
      redirect: "follow",
    });
    if ((!response.ok || !response.body) && authHeaders) {
      response = await fetch(url, { redirect: "follow" });
    }

    if (!response.ok || !response.body) return null;
    return {
      stream: response.body,
      contentType: response.headers.get("content-type") || "application/zip",
    };
  }

  for (const ref of refs) {
    try {
      const assetResult = await fetchReleaseAssetForRef(ref);
      if (assetResult) return assetResult;
    } catch {
      // Keep trying alternate refs.
    }
  }

  try {
    return await fetchZipForRef(`v${tag.replace(/^v/i, "")}`);
  } catch {
    try {
      return await fetchZipForRef(tag.replace(/^v/i, ""));
    } catch {
      return null;
    }
  }
}
