# Namespace-shaped `export const` over true `export namespace`

Service SDK public surfaces keep call sites like `AccountPublicService.getUser()`, but are authored as `export const AccountPublicService = { … }` (separate function bindings + static object), not TypeScript `export namespace`. True namespaces emit an IIFE that Next 16.2 does not member-tree-shake after `tsc` → `dist/`; the const-object shape does, which is required for this lab’s unused-marker proof. See [docs/research/next-tsc-namespace-treeshaking.md](../research/next-tsc-namespace-treeshaking.md). Revisit with the packaging marker search whenever shake-out needs re-proving on a new Next/bundler version.

## Considered Options

- **True `export namespace`** — honest TS keyword; fails unused-member shake-out on Next 16.2 (Turbopack + webpack).
- **Namespace-shaped `export const` (chosen)** — same call site; shake-out passes marker search.
- **Named exports only (`import { getUser }`)** — shakeable, but breaks the required `AccountPublicService.getUser()` API.

## Consequences

- Prior “single-file `export namespace`” wording in [Lock account SDK demo API](https://github.com/atiq-playground/esm-treeshake-lab/issues/2) is superseded for **emit**; method lists and call sites remain.
- Packaging contract includes a falsifiable marker `rg` over `.next/**/*.js` (exclude maps) after SDK `dist` + `next build`.
