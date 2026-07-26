# ESM Tree-Shake Lab

A monorepo lab for packaging service SDKs so many apps can depend on only what they import, with verifiable ESM tree-shaking.

## Language

**Service SDK**:
A workspace package under `packages/services/*` that wraps HTTP calls to a backend (plus light web/app orchestration when needed). Not a deployable server and not where fake backend logic lives.
_Avoid_: treating SDKs as the NestJS service, microservice implementation, `@service/web`

**Identity service**:
The Cloudflare Worker at `apps/identity-service` (`@apps/identity-service`) that owns authentication (OIDC-shaped token/introspect/revoke) and account/user HTTP on one origin via Hono + D1 — the usual combined “identity” surface for demos.
_Avoid_: separate Nest auth-service/account-service deployables, putting minting/DB inside Service SDK packages

**Auth** *(capability on Identity service)*:
OIDC-shaped token routes under `/public/api/oauth/*` (and admin token routes).
_Avoid_: treating auth as a separate deployable in this lab

**Account** *(capability on Identity service)*:
Account HTTP routes under `/public/api/v1/*` and `/admin/api/v1/admin/*`.
_Avoid_: implementing account persistence inside account SDK packages

**Core package**:
Shared SDK support code that exists only for Service SDKs (`packages/core/service-core`, imported as `@service/core`).
_Avoid_: app config module, `@tns/core`

**Web app**:
The Next.js UI application at `apps/web`. Local imports use `@/`; its workspace name is `@apps/web` when a package name is required.
_Avoid_: `@service/web`, `apps/www`

**Account public**:
The Service SDK surface for non-admin account operations (`@service/account-public`).
_Avoid_: account-public-service (as an npm name)

**Account admin**:
The Service SDK surface for administrative account operations (`@service/account-admin`).
_Avoid_: account-admin-service (as an npm name)

**Token public**:
The Service SDK surface for end-user JWT session operations (`@service/token-public`) — create/verify/refresh style flows for the lab.
_Avoid_: NextAuth as the SDK name, calling this a deployable auth service

**Token admin**:
The Service SDK surface for administrative token/session operations (`@service/token-admin`).
_Avoid_: merging admin token ops into account-admin

**Auth session**:
The safe client-visible signed-in state for the Web app (`authenticated`, account id, display name) with tokens kept only in httpOnly cookies.
_Avoid_: NextAuth session, putting tokens in JSON or client storage

**Public user**:
Minimal account fields exposed to non-admin clients (`id`, `email`, `displayName`).
_Avoid_: returning DOB or admin-only fields on the public SDK

**Admin user**:
Richer account record for admin clients (public fields plus e.g. date of birth, status, createdAt).
_Avoid_: using the same type as Public user

**Deployable service app**:
A future process under `apps/*` that is deployed and talked to over the network. Out of scope for the current windwaker effort.
_Avoid_: calling a Service SDK a deployable service
