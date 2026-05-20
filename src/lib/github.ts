import { App } from "octokit";
import { releaseCache, type ReleaseInfo } from "./cache";

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

function getApp(): App {
  if (appInstance) return appInstance;

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

  appInstance = new App({
    appId,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  });

  return appInstance;
}

async function getInstallationOctokit() {
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  if (!installationId) {
    throw new Error("GITHUB_APP_INSTALLATION_ID must be set");
  }
  return getApp().getInstallationOctokit(Number(installationId));
}

export async function getLatestRelease(owner: string, repo: string, pluginSlug: string): Promise<ReleaseInfo | null> {
  const cached = releaseCache.get(pluginSlug);
  if (cached) return cached;

  try {
    const octokit = await getInstallationOctokit();
    const { data } = await octokit.rest.repos.getLatestRelease({ owner, repo });

    const info: ReleaseInfo = {
      version: data.tag_name.replace(/^v/, ""),
      changelog: data.body || "",
      publishedAt: data.published_at || data.created_at,
      zipDownloadUrl: data.zipball_url || "",
    };

    releaseCache.set(pluginSlug, info);
    return info;
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 404) {
      return null;
    }
    throw err;
  }
}

export async function streamReleaseZip(owner: string, repo: string, tag: string): Promise<{ stream: ReadableStream; contentType: string } | null> {
  try {
    const octokit = await getInstallationOctokit();

    const { url } = await octokit.rest.repos.downloadZipballArchive({
      owner,
      repo,
      ref: `v${tag}`,
      request: { redirect: "manual" },
    });

    const response = await fetch(url);
    if (!response.ok || !response.body) return null;

    return {
      stream: response.body,
      contentType: response.headers.get("content-type") || "application/zip",
    };
  } catch {
    try {
      const octokit = await getInstallationOctokit();
      const { url } = await octokit.rest.repos.downloadZipballArchive({
        owner,
        repo,
        ref: tag,
        request: { redirect: "manual" },
      });

      const response = await fetch(url);
      if (!response.ok || !response.body) return null;

      return {
        stream: response.body,
        contentType: response.headers.get("content-type") || "application/zip",
      };
    } catch {
      return null;
    }
  }
}
