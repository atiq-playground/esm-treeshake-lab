# ESM tree-shake lab

[![CI](https://github.com/atiq-playground/esm-treeshake-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/atiq-playground/esm-treeshake-lab/actions/workflows/ci.yml)
[![Deploy](https://github.com/atiq-playground/esm-treeshake-lab/actions/workflows/deploy.yml/badge.svg)](https://github.com/atiq-playground/esm-treeshake-lab/actions/workflows/deploy.yml)
[![Release](https://img.shields.io/github/v/release/atiq-playground/esm-treeshake-lab?display_name=tag&sort=semver)](https://github.com/atiq-playground/esm-treeshake-lab/releases)
[![Bun](https://img.shields.io/badge/bun-1.3.14-fbf0df?logo=bun&logoColor=f472b6)](package.json)
[![License](https://img.shields.io/github/license/atiq-playground/esm-treeshake-lab)](LICENSE)

![Lab progress](https://img.shields.io/badge/lab_progress-95%25-brightgreen)
`███████████████████░` **95%** - on GitHub with green CI and [v0.1.0](https://github.com/atiq-playground/esm-treeshake-lab/releases/tag/v0.1.0). Ops leftovers → [Repo todos](#repo-todos-not-configured-yet).

**What this is**  
A Nx + Bun lab for **member tree-shaking** of Service SDKs (`@service/*` → `tsc` → `dist/` → Next).

**Why a full app**  
Shake-out is proven on a close-to-real demo (auth, accounts, Worker), not toy scripts, so you can see how it looks in something you'd ship.

## Layout

| Path | Role |
|------|------|
| `apps/web` | Next.js app + cookie auth BFF |
| `apps/identity-service` | Tokens + account APIs (Worker + D1) |
| `packages/services/*` | `@service/account-*`, `@service/token-*` |
| `packages/core/*` | Shared service core |
| `scripts/check-treeshake-markers.sh` | CI proof unused SDK markers are gone |

## Getting started

```bash
bun install
cp apps/identity-service/.dev.vars.example apps/identity-service/.dev.vars
bun run db:migrate:identity

# Terminal A - identity Worker (:8787)
bun run dev:identity

# Terminal B - Next
export AUTH_PUBLIC_API_URL=http://127.0.0.1:8787/public/api
export AUTH_ADMIN_API_URL=http://127.0.0.1:8787/admin/api
export ACCOUNT_PUBLIC_API_URL=http://127.0.0.1:8787/public/api
export ACCOUNT_ADMIN_API_URL=http://127.0.0.1:8787/admin/api
export OIDC_CLIENT_SECRET=replace-me
export COOKIE_SECURE=0
bun run dev
```

Demo login: `demo@example.com` / `password`.

## Scripts

| Script | What it does |
|--------|----------------|
| `dev` | Next dev (`@apps/web`) |
| `dev:identity` | Identity Worker (`wrangler dev`) |
| `db:migrate:identity` | Apply D1 migrations locally |
| `build` | `nx run-many -t build` |
| `check:treeshake` | Search `.next` for shake markers |
| `test:e2e` | Playwright (local; not in CI yet) |
| `orchestrate` | Sandcastle AFK runner (**not configured**) |

## Identity service

One deployable "identity" surface: OIDC-shaped tokens and user/account APIs under `/public/api` and `/admin/api`, so token and account SDKs stay separate packages against one origin. Easy to extract later for other demos.

**Data model (lab IdP, not production IAM)**

- Passwords: PBKDF2-SHA256 (210k), `salt$hash`
- Opaque access/refresh: SHA-256 hashes only; refresh rotation + `family_id`
- Users: soft delete, `rvn`, email/password/login timestamps, lockout
- `roles` / `user_roles`; append-only `audit_logs`
- Password change / suspend / soft-delete / admin reset → sessions revoked
- No MFA; HS256 shared secret; no reset emails

## Repo todos (not configured yet)

Scaffolding exists; these are **not wired** until setup is finished:

| Item | Gap |
|------|-----|
| **Sandcastle / AFK** | No `.sandcastle/.env`, Docker image, or AFK Action; `setup-skills` triage still outstanding. See [`.sandcastle/README.md`](.sandcastle/README.md) |
| **Cloudflare Deploy** | Repo secrets `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` unset; preview deploy will fail |
| **E2E in CI** | Playwright under `apps/web`; CI does not run `test:e2e` yet |
| **Lab IdP limits** | MFA / reset email / stronger crypto; intentional until promoted beyond demo |
