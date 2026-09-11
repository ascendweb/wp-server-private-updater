# TacoWP (private plugin registry server)

Self-hosted registry for distributing **private WordPress plugin updates**. Admins register plugins backed by private GitHub repos. Licensed WordPress sites run the worker plugin ([wp-plugin-private-updater](https://github.com/ascendweb/wp-plugin-private-updater)), which checks for updates, reports inventory, and executes remote install/update commands.

This repo is the Next.js app (dashboard + API). The worker lives in the sibling plugin repo; API or ping-protocol changes usually need a matching plugin change.

Product name in the README is **TacoWP**. Default public URL used by the plugin: `https://plugins.ascendde.dev`.

## Stack

- Next.js 16 (App Router), React 19, Tailwind 4 / shadcn
- Prisma + PostgreSQL
- NextAuth v5 (`src/lib/auth.ts`)
- GitHub App via Octokit (`src/lib/github.ts`) for private releases and webhooks

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed    # initial admin from ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev
```

## Domain model (`prisma/schema.prisma`)

- **Plugin** — slug, GitHub owner/repo, release asset pattern, cached latest release
- **Site** — URL, `siteToken` (HMAC + poll auth), optional `pushUrl` / `wpeAuth`, status
- **License** — key bound to a site URL; WordPress client APIs authenticate with this
- **SitePlugin** — per-site install: version, active, locked, pinned version, autoSync
- **Command** — queued work for a site (`update`, `install`, `rollback`, `activate`, `deactivate`, `refresh`, `purge_cache`)

## Auth split (do not mix)

| Surface | Auth |
| --- | --- |
| Dashboard + `/api/v1/plugins`, licenses, users, stats, connect complete | NextAuth session |
| WordPress client (`update-check`, `download`, `license/validate`, `plugins/available`, `heartbeat`) | License key + site URL |
| Command poll / result / status | `siteToken` |
| GitHub webhooks | GitHub App webhook secret |
| Push to a site | HMAC-SHA256 of `ping:{ts}` with `siteToken`; POST to the site **front page** |

## Release pipeline

1. GitHub App reads private repo releases (webhook `POST /api/v1/github/webhooks` or admin refresh).
2. Latest version is stored on `Plugin` (`src/lib/plugin-release.ts`).
3. Sites learn about updates via `GET /api/v1/update-check` (and batch).
4. ZIP download `GET /api/v1/download/:slug/:version` streams the GitHub release asset through this server so sites never need GitHub credentials.

## Commands and remote ping

Dashboard enqueue → `src/lib/commands.ts` creates a `Command`, then **pings** `https://site.example/` (trailing slash, not wp-admin).

The worker verifies HMAC, then POSTs `/api/v1/commands/poll` and later `/api/v1/commands/:id/result`. If the ping fails, the command stays `pending` for cron poll.

**Host constraint:** never ping `/wp-admin/`. Managed hosts (WP Engine) decide PHP-write permission before plugin code runs; an anonymous wp-admin POST is refused and unzip fails midway. Same pattern as ManageWP / MainWP.

Optional `wpe-auth` cookie is stored on `Site` when the worker returns it, so later pings pass WP Engine’s cache/WAF.

## Layout

- `src/app/(dashboard)/` — admin UI (plugins, sites, licenses, users)
- `src/app/api/v1/` — HTTP API
- `src/lib/` — GitHub, licenses, commands, rollout, site URL helpers
- `src/app/connect/approve/` — connect-from-wp-admin approval

README.md lists routes; keep it updated when adding endpoints.

## Conventions

- License-key WordPress routes are public (no session) but must validate license + site URL.
- Rollout / per-site pin / autoSync live on `SitePlugin`, not on `Plugin`.
- Inflight commands older than one hour are expired as failed (`expireStaleCommands`).
- Do not commit `.env` or GitHub App private keys.
