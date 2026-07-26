# Research: Next.js 16 + `tsc` namespace tree-shaking

- **Date:** 2026-07-22
- **Ticket:** [Research Next + tsc namespace tree-shaking](https://github.com/atiq-playground/esm-treeshake-lab/issues/3)
- **Map:** [ESM tree-shake lab monorepo](https://github.com/atiq-playground/esm-treeshake-lab/issues/1)
- **Stack under test:** Next.js `16.2.10` (Turbopack default production build; webpack via `next build --webpack`), TypeScript `^5`, Bun workspaces

## Question

For Next.js 16 consuming Bun workspace packages that emit ESM via `tsc` and use TypeScript `export namespace`, what is a reliable way to verify that unused namespace members are dropped from the production build while used members remain?

Also capture: required `package.json` `exports` / `type` shape, whether `transpilePackages` is still needed when consuming `dist/`, where to look under `.next/`, and exact CLI commands for `@apps/web` production build + marker search.

## Executive answer

1. **`tsc` emits `export namespace` as a single IIFE that assigns every member** onto one exported object. That shape is **not** member-tree-shaken by Next 16.2 (Turbopack or webpack): unused method markers remain in `.next/**/*.js`.
2. **A namespace-looking but call-site-compatible alternative: `export const AccountPublicService = { getUser, … }`: is member-tree-shaken** by the same Next builds: unused markers disappear from JS chunks while `AccountPublicService.getUser(...)` still works.
3. **Verification procedure that works:** production `next build` in `@apps/web`, then search **compiled JS under `.next`** (not HTML/RSC payloads, not `.map`) for the markers from [Lock account SDK demo API](https://github.com/atiq-playground/esm-treeshake-lab/issues/2).
4. **`transpilePackages` is not required** when packages ship plain JS via `exports` → `dist/` (Next’s own docs say you can build to JS and point `main`/`exports` at it instead of listing the package).
5. **Recommended package shape for shakeability:** `"type": "module"`, conditional `exports` pointing at `dist`, and `"sideEffects": false` (webpack’s documented hint; harmless for the const-object case that already shook without it in our trials).

Ticket [Lock TypeScript dist packaging conventions](https://github.com/atiq-playground/esm-treeshake-lab/issues/5) must lock whether the lab keeps true `export namespace` (and therefore **cannot** prove member shake-out) or adopts a namespace-*shaped* `export const` (and can).

---

## Findings

### 1. How `tsc` emits `export namespace` (ESM)

Empirically, with both `"module": "NodeNext"` and `"module": "ESNext"`, TypeScript 5 emits:

```js
export var AccountPublicService;
(function (AccountPublicService) {
  async function getUser(id) { /* … */ }
  AccountPublicService.getUser = getUser;
  async function updateProfile(id) { /* … */ }
  AccountPublicService.updateProfile = updateProfile;
  // …
})(AccountPublicService || (AccountPublicService = {}));
```

All members are installed via property assignment inside one evaluated IIFE. The TypeScript handbook documents namespaces as a runtime organizational construct ([Namespaces](https://www.typescriptlang.org/docs/handbook/namespaces.html)); it does **not** claim member-level dead-code elimination after emit. For Node ESM detection / `"type": "module"`, see [Node.js Packages: Determining module system](https://nodejs.org/api/packages.html#determining-module-system) and TypeScript’s [`module` / `nodenext` reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html).

**Implication:** bundlers see one live export that is mutated. That is a known hard case for property-level DCE (historically called out for Rollup against the same IIFE pattern). Next 16.2 does not recover member shaking from this emit (see § Empirical matrix).

### 2. `package.json` shape that Next can resolve and (when the JS allows) tree-shake

From [Node.js package entry points](https://nodejs.org/api/packages.html#package-entry-points) and Next’s bundling guidance:

```json
{
  "name": "@service/account-public",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "types": "./dist/index.d.ts"
}
```

| Field | Why |
| --- | --- |
| `"type": "module"` | Makes `.js` under the package ESM for Node ([Node packages](https://nodejs.org/api/packages.html#determining-module-system)). Aligns with `module: NodeNext` emit. |
| `"exports"` | Modern entry; prefer over bare `"main"` ([Node package entry points](https://nodejs.org/api/packages.html#package-entry-points)). Point only at compiled `dist`. |
| `"sideEffects": false` | Webpack’s documented purity hint for pruning unused modules / exports ([webpack Tree Shaking](https://webpack.js.org/guides/tree-shaking/)). Does **not** fix `export namespace` IIFE non-shaking in our tests; still recommended for `@service/*`. |
| No CJS `"require"` branch | Avoid dual-package hazards unless a consumer needs CJS. |

### 3. `transpilePackages` when consuming `dist/`

Next docs ([`transpilePackages`](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages)):

> Add a package when a `node_modules` dependency ships raw TypeScript or JSX… **or you can build the package to plain JavaScript and point its `main`/`exports` at the compiled output.**

Also: Turbopack (and webpack App Router) already transpile monorepo workspace packages automatically in many layouts; listing is for the cases above / Pages Router edge cases.

**Lab guidance:** with `tsc` → `dist/` and `exports` → those `.js` files, **do not require `transpilePackages` for `@service/*`**. Add it only if a package temporarily exports `.ts`/JSX source or needs Next-specific transforms (`'use client'`, CSS modules, etc.).

Do **not** also list the same package in `serverExternalPackages` (Next throws).

### 4. Where markers land under `.next/`

After `next build` (Turbopack default in 16.2):

| Location | Role for marker search |
| --- | --- |
| `.next/server/chunks/ssr/*.js` | **Primary.** Server/SSR chunks that inlined or retained SDK code. |
| `.next/static/chunks/*.js` | Client chunks: check if any SDK call sites are client-bundled. |
| `.next/server/app/**/*.html`, `*.rsc`, `*.segments/**` | Prerendered **payload**. Used markers appear here as **rendered strings** even when the function body was DCE’d from JS. Do **not** treat HTML/RSC hits as “code retained.” |
| `*.js.map` | Source maps may retain unused strings. **Exclude maps** from the pass/fail search. |

Optional analysis (not required for marker proof): [`next experimental-analyze`](https://nextjs.org/docs/app/guides/package-bundling) / `next build --experimental-analyze` (Turbopack; writes under `.next/diagnostics/analyze`).

### 5. Empirical matrix (Next `16.2.10`, Bun workspaces)

Minimal App Router page called only `AccountPublicService.getUser("123")` (or bare `getUser` in the named-export control). Markers were string literals returned / logged by each method.

| Emit shape | Bundler | Used marker in `.js` | Unused markers in `.js` |
| --- | --- | --- | --- |
| `export namespace AccountPublicService { … }` (tsc IIFE) | Turbopack | yes | **yes (not shaken)** |
| same | webpack (`next build --webpack`) | yes | **yes (not shaken)** |
| `export const AccountPublicService = { getUser, updateProfile, changePassword }` | Turbopack | yes | **no (shaken)** |
| same | webpack | yes | **no (shaken)** |
| Per-method files + const object barrel (`sideEffects: false`) | Turbopack | yes | **no (shaken)** |
| Named ESM exports + direct `import { getUser }` | Turbopack | yes | **no (shaken)** |
| Split `export namespace` per file + `export *` barrel | - | broken (TS2308 / runtime missing members) | n/a |

**Conclusion for the lab goal (“prove unused namespace members shaken”):** true TypeScript `export namespace` **fails** the proof on Next 16.2. A **namespace-shaped `export const`** keeps `AccountPublicService.getUser` call sites and **passes** the marker test.

### 6. Pitfalls

- **IIFE namespace emit:** property assignment prevents member DCE (see matrix).
- **Judging by HTML/RSC:** used markers appear in prerender output as data; search **JS only**.
- **Source maps:** can false-positive unused markers: exclude `*.map`.
- **Barrel + side effects:** webpack documents that without reliable side-effect info, unused exports are harder to drop ([Tree Shaking](https://webpack.js.org/guides/tree-shaking/)). Prefer `"sideEffects": false` on SDK packages; still insufficient for IIFE namespaces.
- **`optimizePackageImports`:** helps large multi-export packages ([docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports)); irrelevant to single-file namespace IIFEs and not a substitute for a shakeable emit.
- **`serverExternalPackages`:** would leave the package unbundled (Node `require`/`import` at runtime): wrong for a tree-shake demo ([package bundling](https://nextjs.org/docs/app/guides/package-bundling)).
- **Cross-file `export namespace` merge via `export *`:** TypeScript rejects duplicate exported names; not a viable split strategy.

---

## Recommended verification procedure (`@apps/web`)

Assume markers from [Lock account SDK demo API](https://github.com/atiq-playground/esm-treeshake-lab/issues/2), e.g.:

- Used: `EXECUTING_ACCOUNT_PUBLIC_GET_USER`, `EXECUTING_ACCOUNT_ADMIN_GET_USERS`
- Unused examples: `EXECUTING_ACCOUNT_PUBLIC_UPDATE_PROFILE`, `EXECUTING_ACCOUNT_ADMIN_SUSPEND_USER`, …

```bash
# From monorepo root: build SDKs first (exact Nx target names TBD by bootstrap ticket), then web:
bun run nx run @apps/web:build
# or, once apps/web is the Next app:
cd apps/web && bun run build
# Optional webpack comparison:
cd apps/web && bunx next build --webpack
```

```bash
# Pass/fail: search compiled JS only (exclude maps). Adjust roots if app cwd differs.
USED='EXECUTING_ACCOUNT_PUBLIC_GET_USER|EXECUTING_ACCOUNT_ADMIN_GET_USERS'
UNUSED='EXECUTING_ACCOUNT_PUBLIC_UPDATE_PROFILE|EXECUTING_ACCOUNT_PUBLIC_CHANGE_PASSWORD|EXECUTING_ACCOUNT_ADMIN_SUSPEND_USER'

cd apps/web

echo '=== USED (expect hits in .js and possibly HTML/RSC) ==='
rg -n -e "$USED" .next -g '*.js' -g '!*.map' || true

echo '=== UNUSED (expect ZERO hits in .js) ==='
if rg -n -e "$UNUSED" .next -g '*.js' -g '!*.map'; then
  echo 'FAIL: unused markers still in JS chunks'
  exit 1
else
  echo 'PASS: unused markers absent from JS'
fi

echo '=== Sanity: unused must not hide only in maps ==='
rg -n -e "$UNUSED" .next -g '*.map' || echo '(none in maps either)'
```

**Interpretation rules:**

1. **Pass:** every *used* marker appears in at least one `.next/**/*.js` **or** is acceptable only as prerendered page text if the call was fully inlined away: prefer still seeing the used path exercised (page content / server chunk). For this lab, asserting used markers in JS *or* RSC/HTML **and** unused markers absent from JS is enough.
2. **Fail:** any *unused* marker string in `.next/**/*.js` (excluding maps).
3. If unused markers appear only under a surprising chunk path, widen the search to all of `.next` with the same JS filter: do not narrow to a single filename; Turbopack hashes chunk names (`[root-of-the-server]__*.js`).

---

## What [Lock TypeScript dist packaging conventions](https://github.com/atiq-playground/esm-treeshake-lab/issues/5) still must lock

- **Emit style:** true `export namespace` vs namespace-shaped `export const` (call-site compatibility vs shake proof).
- Shared `tsconfig` (`module` / `moduleResolution` / `declaration` / `outDir`).
- Exact `exports` / `types` / whether to omit `"main"`.
- Whether `"sideEffects": false` is mandatory on every `@service/*` package.
- How `@apps/web` depends on workspace packages (Bun `workspace:*`) and Nx build order before `next build`.
- Whether CI runs the marker `rg` script as a required check.

---

## Sources

### Primary / first-party

- Next.js [`transpilePackages`](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages) (also vendored at `node_modules/next/dist/docs/.../transpilePackages.md`)
- Next.js [Optimizing package bundling](https://nextjs.org/docs/app/guides/package-bundling)
- Next.js [`optimizePackageImports`](https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports)
- TypeScript [Namespaces](https://www.typescriptlang.org/docs/handbook/namespaces.html)
- TypeScript [Modules reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html) (`nodenext` emit / resolution)
- Node.js [Packages](https://nodejs.org/api/packages.html) (`type`, `exports`)
- webpack [Tree Shaking](https://webpack.js.org/guides/tree-shaking/) (`sideEffects`, ESM static structure)
- Local empirical builds: Next `16.2.10` + `tsc` emit samples (2026-07-22), commands above

### Related lab decisions

- [Lock account SDK demo API](https://github.com/atiq-playground/esm-treeshake-lab/issues/2): marker strings and demo call sites
