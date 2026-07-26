# Namespace-shaped `export const` over true `export namespace`

- **Status:** Accepted
- **Date:** 2026-07-22

## Context

Public surfaces need dotted call sites (e.g. `Svc0.used()` / `AccountPublicService.getUser()`) and unused-member tree-shaking when only some methods are imported.

True TypeScript `export namespace` emits an IIFE with property assignment. On Next 16.2 (Turbopack + webpack) after `tsc` → `dist/`, that shape does **not** member-tree-shake; unused markers stay in JS. See [docs/research/next-tsc-namespace-treeshaking.md](../research/next-tsc-namespace-treeshaking.md).

## Decision

Author ESM stubs as **named function exports** plus a **namespace-shaped `export const`**, not `export namespace`:

```ts
export function used(): string { /* … */ }
export function unused(): … { /* … */ }
export const Svc0 = { used, unused };
```

Smoke and the generator follow this (`packages/lab/smoke/esm/*`, `scripts/lab/generate-scale-bench.ts`).

## Considered options

- **True `export namespace`**: honest TS keyword; fails unused-member shake-out on Next 16.2 (Turbopack + webpack).
- **Namespace-shaped `export const` (chosen)**: same dotted call site; shake-out passes marker search.
- **Named exports only**: shakeable, but drops the dotted `SvcN.used()` / `AccountPublicService.getUser()` API.

## Consequences

- Prior “single-file `export namespace`” wording in [Lock account SDK demo API](https://github.com/atiq-playground/esm-treeshake-lab/issues/2) is superseded for **emit**; dotted call sites remain via the const object.
- Re-prove with the Next `.next/**/*.js` marker search (exclude maps) whenever shake-out needs checking on a new Next/bundler version — see the research note.
