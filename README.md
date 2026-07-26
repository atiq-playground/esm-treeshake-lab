# ESM tree-shake lab

[![CI](https://github.com/atiq-playground/esm-treeshake-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/atiq-playground/esm-treeshake-lab/actions/workflows/ci.yml)
[![Deploy](https://github.com/atiq-playground/esm-treeshake-lab/actions/workflows/deploy.yml/badge.svg)](https://github.com/atiq-playground/esm-treeshake-lab/actions/workflows/deploy.yml)
[![Release](https://img.shields.io/github/v/release/atiq-playground/esm-treeshake-lab?display_name=tag&sort=semver)](https://github.com/atiq-playground/esm-treeshake-lab/releases)
[![Bun](https://img.shields.io/badge/bun-1.3.14-fbf0df?logo=bun&logoColor=f472b6)](package.json)
[![License](https://img.shields.io/github/license/atiq-playground/esm-treeshake-lab)](LICENSE)

![Lab progress](https://img.shields.io/badge/lab_progress-90%25-yellowgreen)
`██████████████████░░` **90%** — monorepo + shake proof work locally; not ready until this lands on GitHub with green CI.

Nx + Bun monorepo lab: Service SDKs (`@service/*`) built with `tsc` → `dist/`,
consumed by `apps/web` (Next.js). Auth + account HTTP live in one Cloudflare
Worker — **`apps/identity-service`** (Hono + D1).

## Identity service

One deployable that is the usual **identity** surface: tokens/OIDC-shaped auth
and user/account APIs. Same URL prefixes (`/public/api`, `/admin/api`) so
`@service/token-*` and `@service/account-*` keep calling distinct SDK packages
against one origin. Easy to extract into its own repo for other demo apps.

## Security / identity data model

- Passwords: **PBKDF2-SHA256**, 210k iterations, random salt (`salt$hash`)
- Opaque access/refresh tokens: only **SHA-256 hashes** in D1; refresh **rotation** + `family_id`
- Users: `updated_at`, `deleted_at` (soft delete), `rvn` (optimistic concurrency),
  `email_verified_at`, `password_changed_at`, `last_login_at`, lockout fields
- `roles` / `user_roles`; append-only `audit_logs`
- Password change / suspend / soft-delete / admin reset → sessions revoked
- No MFA yet

Still a **lab** IdP (HS256 shared secret, no reset emails), not full production IAM.

## Getting started

```bash
bun install

bun run db:migrate:identity

# Terminal A — identity Worker (:8787)
bun run dev:identity

# Terminal B — Next
export AUTH_PUBLIC_API_URL=http://127.0.0.1:8787/public/api
export AUTH_ADMIN_API_URL=http://127.0.0.1:8787/admin/api
export ACCOUNT_PUBLIC_API_URL=http://127.0.0.1:8787/public/api
export ACCOUNT_ADMIN_API_URL=http://127.0.0.1:8787/admin/api
export OIDC_CLIENT_SECRET=replace-me
export COOKIE_SECURE=0
bun run dev
```

Demo login: `demo@example.com` / `password`.

Copy `apps/identity-service/.dev.vars.example` → `apps/identity-service/.dev.vars`.

## Scripts (root)

| Script | Command |
|--------|---------|
| `dev` | `@apps/web` Next dev |
| `dev:identity` | Identity Worker (`wrangler dev`) |
| `db:migrate:identity` | Apply D1 migrations locally |
| `build` | `nx run-many -t build` |
| `check:treeshake` | Marker search on `apps/web/.next` |
