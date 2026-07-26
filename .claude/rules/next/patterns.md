> This file extends [react/coding-style.md](../react/coding-style.md) and
> [web/coding-style.md](../web/coding-style.md) with Next.js App Router
> conventions specific to this Template. Template-owned (see `CONTEXT.md` in
> `ai-harness`: "template soul"); the Harness install never writes or
> overwrites this file.

# Next.js App Router (Template Soul)

## Runtime & deployment target

- Install, run, and test with **Bun** (`bun install`, `bun run dev`, `bun run
  test`): never `npm`/`yarn`/`pnpm`.
- This App builds for **Cloudflare Workers** via `@opennextjs/cloudflare`
  (`bun run build:cf`), not `@cloudflare/next-on-pages` (deprecated path.
  see `ai-harness` ADR-0004). Keep the Node runtime (the default); do not add
  `export const runtime = "edge"` to a route: OpenNext's Workers adapter
  targets Node-compatible Workers via `nodejs_compat`, not the Edge runtime.
- `wrangler.jsonc` and the `@opennextjs/cloudflare`/`wrangler` versions in
  `package.json` are pinned deliberately (this ecosystem moves fast): bump
  them as an explicit, reviewed change, not incidentally.
- `next.config.ts` pins `turbopack.root` to `__dirname` because this
  Template develops nested inside the `create-atiq-app` monorepo (which has
  its own lockfile); a scaffolded App can drop that pin once it has its own
  root lockfile, but leaving it is harmless.

## File conventions (App Router)

- Route segments live under `src/app/`; a folder is a route only once it
  contains a `page.tsx`.
- Use the reserved file names for their one job: don't rename or repurpose
  them: `page.tsx` (route UI), `layout.tsx` (shared shell, preserves state
  across navigation), `template.tsx` (like layout, but remounts per
  navigation: only when you specifically need that), `loading.tsx`
  (`Suspense` boundary), `error.tsx` (`"use client"` error boundary),
  `not-found.tsx`, `route.ts` (Route Handler: mutually exclusive with
  `page.tsx` in the same segment).
- Co-locate a route's private components/helpers in the same folder; only
  hoist to `src/components/` (or similar) once genuinely shared across
  routes.
- Server vs. Client Component boundary rules live in
  [react/coding-style.md](../react/coding-style.md): this file does not
  repeat them.

## Data & caching

- Prefer `fetch()` with an explicit caching intent: `{ cache: "no-store" }`
  for per-request data, `{ next: { revalidate: <seconds> } }` for
  time-based, or `{ next: { tags: [...] } }` paired with
  `revalidateTag`/`revalidatePath` for on-demand invalidation. Never rely on
  the implicit default silently changing behavior across Next.js versions.
- Mutations go through Server Actions (`"use server"`) or Route Handlers,
  not client-side fetches to your own API when a Server Action will do.
- `generateMetadata`/the static `metadata` export are the only supported way
  to set `<head>` tags: never hand-write a `<head>` element in a Server
  Component.

## Testing

- Unit/component tests: Vitest, co-located as `*.test.tsx` next to the
  source file (see `src/app/page.test.tsx`), run via `bun run test`.
- End-to-end smoke tests: Playwright, under a top-level `e2e/` directory
  (excluded from the Vitest run in `vitest.config.ts`), run via
  `bun run test:e2e`: see create-atiq-app issue #9.
- Never run `bun test`. That is Bun's built-in runner; it ignores
  `package.json` scripts and will mis-execute Vitest/Playwright files.
  `bunfig.toml` points it at `.bun-test-guard/` so a bare `bun test` fails
  with a redirect to the scripts above.
- The AFK Sandcastle sandbox (`.sandcastle/`) runs the same `bun run
  lint`/`typecheck`/`test` scripts a human or CI would: don't special-case
  behavior for "running inside the sandbox".

## Imports & aliases

- `@/*` resolves to `./src/*` (see `tsconfig.json` `paths` and
  `vitest.config.ts` `resolve.alias`): prefer it over deep relative
  imports (`../../../lib/x`) once you cross a route/component boundary.
