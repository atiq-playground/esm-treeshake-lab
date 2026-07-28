# Namespace-shaped `export const` over true `export namespace`

- **Status:** Superseded
- **Date:** 2026-07-22
- **Superseded:** 2026-07-27

## Context

Public surfaces wanted dotted call sites (e.g. `Svc0.used()` / `AccountPublicService.getUser()`) and unused-member tree-shaking when only some methods are used.

True TypeScript `export namespace` emits an IIFE with property assignment. On Next 16.2 (Turbopack + webpack) after `tsc` → `dist/`, that shape does **not** member-tree-shake; unused markers stay in JS. See [docs/research/next-tsc-namespace-treeshaking.md](../research/next-tsc-namespace-treeshaking.md).

## Original decision (no longer lab policy)

Author ESM stubs as **named function exports** plus a **namespace-shaped `export const`**, not `export namespace`:

```ts
export function used(): string { /* … */ }
export function unused(): … { /* … */ }
export const Svc0 = { used, unused };
```

Empirical note (still true for Next 16.2): importing that const and calling `Svc0.used()` *can* drop unused markers under Next. Keeping the bag in stubs still invited the wrong lesson versus namespace imports over named exports.

## Current decision

ESM lab stubs are **named function exports only**; fixtures consume them with a **namespace import**:

```ts
// stub
export function used(): string { /* … */ }
export function unused(): … { /* … */ }

// consumer (bench)
import * as Svc0 from "@lab/esm-svc-0";
Svc0.used();
```

That keeps dotted `Svc0.used()` / `Users.getUser()` call sites while remaining member-tree-shakable. Not a prebuilt `export const Users = { … }` object bag.

## Considered options

- **True `export namespace`**: honest TS keyword; fails unused-member shake-out on Next 16.2 (Turbopack + webpack).
- **Namespace-shaped `export const`**: can pass Next marker search when calling through the object; removed from lab stubs so the measured API is unambiguously named exports.
- **Named exports + `import * as` (chosen)**: dotted call sites on the consumer; clearest shakable surface without an object bag.

## Consequences

- Smoke + `scripts/lab/generate-scale-bench.ts` no longer emit `export const SvcN = { … }`.
- Fixtures / multi-call / fleet ESM entries use `import * as SvcN` then `SvcN.used()` (and other bound members).
- Research note on Next + `tsc` namespaces remains useful for the emit comparison.
