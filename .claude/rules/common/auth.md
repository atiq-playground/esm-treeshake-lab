# Auth Practices (CRITICAL)

We do **not** outsource to Better Auth, but we emulate its request-scoped model.
Session and bearer credentials are never process-global.

## Invariants

1. **Request-scoped identity.** Resolve session/tokens from the incoming request
   (cookies / headers) on each call. Never cache a user's bearer in a module
   `let`, `globalThis`, singleton, or static field shared across requests.
2. **Explicit credentials on outbound calls.** Pass `Authorization` (or an
   equivalent token argument) into `fetch` / service helpers. Ambient
   `setAccessToken`-style APIs are forbidden.
3. **Server boundary.** Any code that reads, stores, or attaches access,
   refresh, or ID tokens must `import "server-only"` (or live in a Worker /
   server-only package that cannot be imported by client bundles).
4. **Config ≠ credentials.** Process-global app config (issuer URLs, client IDs)
   is fine. User tokens are not config.
5. **Concurrency-safe.** Parallel `Promise.all` and multi-tenant traffic must
   not share auth state. Prefer argument threading; `AsyncLocalStorage` only if
   the alternative is unsafe ambient state — still never a bare module `let`.

## Anti-patterns (reject in review)

```typescript
// FORBIDDEN — races across users/requests; lies if commented "per-request"
let accessToken: string | undefined;
export function setAccessToken(t: string | undefined) {
  accessToken = t;
}

// FORBIDDEN — shared fetch that auto-attaches a process-wide bearer
export async function request(url: string, init?: RequestInit) {
  /* reads module-level accessToken */
}
```

## Correct shape

```typescript
// Resolve once per request from cookies/headers
const { accessToken } = await resolveSession();

// Pass explicitly
await request(url, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

Inspired by Better Auth's cookie → per-request session resolution
(`getSession({ headers })`), not by adopting Better Auth as a dependency.
