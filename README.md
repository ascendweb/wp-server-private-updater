# WP Private Updater

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
| PATCH  | `/api/v1/plugins/:id` | Update plugin fields (name, description, repo, asset pattern) |
| DELETE | `/api/v1/plugins/:id` | Delete a plugin and invalidate its release cache              |

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
| PATCH  | `/api/v1/users/:id` | Update name, email, role, status, or reset password |
| DELETE | `/api/v1/users/:id` | Delete a user (cannot delete yourself)              |

### Releases (admin)

| Method | Path                     | Description                              |
| ------ | ------------------------ | ---------------------------------------- |
| GET    | `/api/v1/releases/:slug` | Fetch latest GitHub release for a plugin |

### Stats (admin)

| Method | Path            | Description                                                                          |
| ------ | --------------- | ------------------------------------------------------------------------------------ |
| GET    | `/api/v1/stats` | Dashboard counts: plugins, licenses, active licenses, recent check-ins, unique sites |

### Site Connection (mixed)

| Method | Path                       | Auth   | Description                                                               |
| ------ | -------------------------- | ------ | ------------------------------------------------------------------------- |
| POST   | `/api/v1/connect/initiate` | Public | Creates a short-lived JWT and returns an admin approval URL               |
| POST   | `/api/v1/connect/complete` | Admin  | Verifies the connect JWT, creates a license, and returns a callback token |

### WordPress Client (public, license-key auth)

| Method | Path                              | Description                                                     |
| ------ | --------------------------------- | --------------------------------------------------------------- |
| GET    | `/api/v1/update-check`            | Check for a newer plugin version and return update metadata     |
| GET    | `/api/v1/download/:slug/:version` | Stream the plugin release ZIP from GitHub                       |
| GET    | `/api/v1/license/validate`        | Check whether a license key is valid for a given site           |
| GET    | `/api/v1/plugins/available`       | List installable plugins for a licensed site with download URLs |

## Environment Variables

See [`.env.example`](.env.example) for all available configuration. Key groups:

- **Database** -- `DATABASE_URL`
- **NextAuth** -- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- **GitHub OAuth** (optional) -- `GITHUB_AUTH_CLIENT_ID`, `GITHUB_AUTH_CLIENT_SECRET`, `GITHUB_AUTH_ALLOWED_ORG`
- **Google OAuth** (optional) -- `GOOGLE_AUTH_CLIENT_ID`, `GOOGLE_AUTH_CLIENT_SECRET`, `GOOGLE_AUTH_ALLOWED_DOMAIN`
- **GitHub App** (for fetching private releases) -- `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID`
- **Admin seed** -- `ADMIN_EMAIL`, `ADMIN_PASSWORD`
