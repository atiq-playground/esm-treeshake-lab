# ESM Tree-Shake Lab

A metrics lab comparing **singleton plugin** packaging vs **ESM selective imports** at scale (N), explained with Fumadocs.

## Language

**Scale bench**:
The esbuild harness that generates or uses smoke `@lab/*` stubs, bundles singleton vs ESM fixtures, and writes case reports under `docs/lab/` (`benchmark-latest.*` for UC1; `-wide` / `-cycles` / `-partial` / `-thirdparty` / `-fleet` siblings for variants).
_Avoid_: treating the docs site as the bench host; in-browser Run-N

**Third-party stubs / fleet**:
`--case=thirdparty` generates deterministic `@lab/3p-*` ballast (shared core + unused extras), not real npm deps. `--case=fleet` multiplies one measured consumer graph by `--consumers=M` (non-GraphQL / multi-app story).
_Avoid_: adding graphql/ORM to CI smoke; letting smoke overwrite UC1 `benchmark-latest.*` (smoke writes `tmp/` only)

**Call sites vs surface**:
`--fns` = functions *defined* per package (shakeable surface). **Call sites** = how many `used()` invocations the fixture actually performs. UC1–UC3: ESM call sites = **1**. UC4 `partial`: call sites = `--used=K` (default `⌊N/2⌋`) on both arms.
_Avoid_: reading “fns=40” as “ESM imported 40 functions”

**Singleton service**:
A class instance on `globalThis`, created with a default constructor, registered via singular `registerPublicService` on import, configured later by plural `registerPublicServices(cfg)`.
_Avoid_: ambient auth tokens; Nest DI as the lab subject

**ESM stub package**:
A `@lab/esm-svc-*` (or smoke) package with named `used` / `unused*` exports (plus namespace-shaped const) so unused exports can be shaken when only `used` is imported.
_Avoid_: requiring a full Next app to prove the delta

**Findings / docs site**:
`apps/docs` (`@apps/docs`): Fumadocs explainer (metrics home, why, run, research). Dark default + light; Nothing tokens. Home reads UC1 `benchmark-latest.json` only.
_Avoid_: product auth demo, identity Worker

**Lab package**:
Workspace packages under `packages/lab/*` (`@lab/singleton-services`, smoke, generated). Generated trees are gitignored; no Nx build targets on stubs.
_Avoid_: `@service/*` demo SDKs (removed)
