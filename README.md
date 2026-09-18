# TacoWP

A self-hosted server for distributing private WordPress plugin updates. Manages plugins sourced from private GitHub repositories, issues license keys to authorize WordPress sites, and serves update metadata and ZIP downloads to the WordPress update system.

Built with Next.js 16, Prisma, PostgreSQL, and NextAuth v5.

## Getting Started

```bash
cp .env.example .env    # configure database, auth, and GitHub App credentials
npm install
npm run db:migrate      # run Prisma migrations
npm run db:seed         # create the initial admin user
npm run dev             # start dev server at http://localhost:3000
```

## API Routes

All admin routes require an authenticated session and return `401 Unauthorized` without one. Public routes use license-key validation instead.

### Authentication

| Method   | Path          | Auth | Description                                                     |
| -------- | ------------- | ---- | --------------------------------------------------------------- |
| GET/POST | `/api/auth/*` | --   | NextAuth handlers (sign-in, sign-out, OAuth callbacks, session) |

### Plugins (admin)

| Method | Path                  | Description                                                   |
| ------ | --------------------- | ------------------------------------------------------------- |
| GET    | `/api/v1/plugins`     | List all plugins with license counts                          |
| POST   | `/api/v1/plugins`     | Create a new plugin from slug, name, and GitHub repo          |
| GET    | `/api/v1/plugins/:id` | Get a single plugin with its licenses                         |
| PATCH  | `/api/v1/plugins/:id` | Update plugin fields (name, description, repo, asset pattern, auto-sync new sites) |
| DELETE | `/api/v1/plugins/:id` | Delete a plugin                                               |

### Licenses (admin)

| Method | Path                   | Description                                             |
| ------ | ---------------------- | ------------------------------------------------------- |
| GET    | `/api/v1/licenses`     | List all licenses with associated plugin info           |
| POST   | `/api/v1/licenses`     | Create a new license for a site URL and optional plugin |
| PATCH  | `/api/v1/licenses/:id` | Update a license (e.g. revoke or reactivate)            |
| DELETE | `/api/v1/licenses/:id` | Delete a license                                        |

### Users (admin)

| Method | Path                | Description                                         |
| ------ | ------------------- | --------------------------------------------------- |
| GET    | `/api/v1/users`     | List all users with linked auth accounts            |
| POST   | `/api/v1/users`     | Create a new email/password user                    |
| GET    | `/api/v1/users/:id` | Get a single user                                   |
| PATCH  | `/api/v1/users/:id` | Update name, email, WP login email, role, status, or reset password |
| DELETE | `/api/v1/users/:id` | Delete a user (cannot delete yourself)              |

### Releases (admin)

| Method | Path                     | Description                              |
| ------ | ------------------------ | ---------------------------------------- |
| GET    | `/api/v1/releases/:slug` | Return the stored latest GitHub release (`?refresh=1` re-fetches from GitHub) |

### GitHub App (public)

| Method | Path                        | Description                                              |
| ------ | --------------------------- | -------------------------------------------------------- |
| POST   | `/api/v1/github/webhooks`   | GitHub App webhook: persist latest release on `Plugin`   |

### Stats (admin)

| Method | Path            | Description                                                                          |
| ------ | --------------- | ------------------------------------------------------------------------------------ |
| GET    | `/api/v1/stats` | Dashboard counts: plugins, licenses, active licenses, recent check-ins, unique sites |

### Site Connection (mixed)

| Method | Path                       | Auth   | Description                                                               |
| ------ | -------------------------- | ------ | ------------------------------------------------------------------------- |
| POST   | `/api/v1/connect/initiate` | Public | Creates a short-lived JWT and returns an admin approval URL               |
| POST   | `/api/v1/connect/complete` | Admin  | Verifies the connect JWT, creates a license, and returns a callback token |

### MCP (OAuth)

Remote MCP for AI agents. Authenticate with OAuth (people) or a service client (automations). Never send license keys or `siteToken`.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET/POST | `/api/mcp` | Bearer JWT (`mcp:read`) | Streamable HTTP MCP. Tools: `sites-list`, `site-get`, `site-get-plugins`, `site-get-commands`, `site-list-tools`, `site-call-tool`, `platform-list-plugins`, `platform-get-plugin-installs`, `platform-get-command` |
| GET | `/.well-known/oauth-protected-resource` | -- | RFC 9728 resource metadata |
| GET | `/.well-known/oauth-authorization-server` | -- | RFC 8414 authorization server metadata |
| GET | `/oauth/authorize` | NextAuth session | Authorization-code + PKCE consent |
| POST | `/oauth/token` | client + PKCE or secret | Token endpoint |
| POST | `/oauth/register` | -- | Dynamic client registration |
| GET | `/oauth/userinfo` | Bearer JWT | OpenID UserInfo |

Connect ChatGPT/Claude with the MCP URL `{SERVER_URL}/api/mcp` and OAuth. Workspace admins can publish the connector so employees do not need Developer mode. For Gemini/automations, create a service client in Settings → MCP and use `client_credentials` against `/oauth/token`.

Do not list this MCP in a public app directory while the registry is single-tenant.

### WordPress Client (public, license-key auth)

| Method | Path                              | Description                                                     |
| ------ | --------------------------------- | --------------------------------------------------------------- |
| GET    | `/api/v1/update-check`            | Check for a newer plugin version and return update metadata     |
| GET    | `/api/v1/download/:slug/:version` | Stream the plugin release ZIP from GitHub                       |
| GET    | `/api/v1/license/validate`        | Check whether a license key is valid for a given site           |
| GET    | `/api/v1/plugins/available`       | List installable plugins for a licensed site with download URLs |
| POST   | `/api/v1/heartbeat`               | Report installed plugin inventory                               |

### Form Monitor (feature)

Isolated form vs tracking pipeline. Gravity Forms reports submissions; WhatConverts (or another tracker) confirms via webhook. Join key is `referenceId` (`tacowp_reference_id`). Missing-tracking alerts are 1-hour delayed pg-boss jobs in the same Postgres (`pgboss` schema). Settings live at `/settings/form-monitor`, linked only from Form Monitor.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/v1/form-monitor/events` | license key + site URL | Record a form submission (`reference_id`, optional form/entry ids) |
| POST | `/api/v1/form-monitor/webhooks/tracking/:token` | unguessable URL | Record a tracking confirmation; ignored without `tacowp_reference_id` |
| GET/POST | `/api/v1/form-monitor/settings` | session | Tracking webhook URL (copy/rotate) and outbound missing-tracking URL |
| GET | `/api/v1/form-monitor/sites` | session | Per-site last form, last tracking, missing last 7 days |
| GET | `/api/v1/form-monitor/sites/:siteId` | session | 7-day submissions vs missing buckets, plus last 15 records |
| POST | `/api/v1/form-monitor/sites/:siteId/mark-fixed` | session | Ignore unmatched form events for a site (`ignoredAt`) |

### Commands (siteToken)

The ping is a signed pointer, not the command. Payload stays on this server. ZIP URLs are hydrated at claim time.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/v1/commands/poll` | `siteToken` | Claim scheduled jobs, or one row when `command_id` is set |
| GET | `/api/v1/commands/pending` | license key + site URL | Legacy poll of scheduled jobs |
| PATCH | `/api/v1/commands/:id/status` | `siteToken` | Mark `in_progress` |
| POST | `/api/v1/commands/:id/result` | `siteToken` | Store JSON result |
| GET | `/api/v1/sites/:siteId/commands` | session | Recent commands for a site |

Deploy **plugin 1.10.0** before using **WP Admin** SSO. Deploy **plugin 1.9.0** before relying on `site-list-tools` / `site-call-tool`. Job pings (`ping:{ts}`) stay compatible; RPC pings sign `ping:{ts}:{command_id}`.

### WordPress SSO

One-time launch into an existing WordPress admin. The browser never sends the email; `siteToken` cannot mint tickets.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET/POST | `/sites/:siteId/launch-wp-admin` | session | Mint a 60s ticket and auto-POST it to the site front page |
| POST | `/api/v1/sso/redeem` | `siteToken` | Atomically consume the ticket and return `{ email }` |

## Environment Variables

See [`.env.example`](.env.example) for all available configuration. Key groups:

- **Database** -- `DATABASE_URL`
- **Server** -- `SERVER_URL` (public-facing base URL for download links, connect flow, and MCP OAuth issuer)
- **Form Monitor** -- optional `FORM_MONITOR_CHECK_DELAY_SECONDS` (default `3600`) for the delayed missing-tracking job. pg-boss uses the same `DATABASE_URL` (its own `pgboss` schema).
- **NextAuth** -- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- **MCP** -- optional `MCP_JWT_SECRET` (defaults to `NEXTAUTH_SECRET`)
- **GitHub OAuth** (optional) -- `GITHUB_AUTH_ENABLED`, `GITHUB_AUTH_CLIENT_ID`, `GITHUB_AUTH_CLIENT_SECRET`, `GITHUB_AUTH_ALLOWED_ORG`
- **Google OAuth** (optional) -- `GOOGLE_AUTH_ENABLED`, `GOOGLE_AUTH_CLIENT_ID`, `GOOGLE_AUTH_CLIENT_SECRET`, `GOOGLE_AUTH_ALLOWED_DOMAIN`
- **GitHub App** (for fetching private releases and receiving new-release webhooks) -- `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_WEBHOOK_SECRET`
- **Admin seed** -- `ADMIN_EMAIL`, `ADMIN_PASSWORD`
