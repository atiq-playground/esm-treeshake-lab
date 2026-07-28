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

**Realistic case**:
`--case=realistic`: GraphQL-shaped preset (default `N=100`, `--fns=20`, `--used=1000` ≈ 10 call sites/pkg, cycles + `--3p=real`). Only case that combines cycles with real third-party ballast. Both arms share the same call sites; no `--seed` shuffle. Report sibling `benchmark-realistic-latest.*`.
_Avoid_: unlocking cycles+3p for UC3/thirdparty; treating `--fns` as “resolvers wired”

**Arm (realistic / scale bench)**:
One packaging side under test: **singleton** vs **ESM**. Cache mode (warm/cold) is not an arm.
_Avoid_: calling warm/cold “arms”

**Realistic pipeline report**:
`arms` / `benefit` hold shipped bytes and markers once. `pipeline.warm` / `pipeline.cold` hold per-arm timings (generate/install/bundle/upload/total). `proof` holds Last verified (`timestamp`, `githubRunUrl`, runner). Compare fair pairs only; never average warm+cold.
_Avoid_: blending cache modes into one score; CF publish fields for the bench

**Request-time harness**:
Sibling `lab:bench:request`: local Node HTTP per arm; `POST /invoke` runs one full pass of wired call sites; defaults warmup 50 / measured 1000 / concurrency 1; fills `request` in the realistic report once per arm. Relative metrics only — not CF isolate or prod gateway RPS.
_Avoid_: hitting the docs Worker; multiplying request metrics by warm/cold install mode

**Realistic GHA proof**:
On-demand workflow `lab-realistic-bench.yml` (`workflow_dispatch` only): one job runs cold→warm→request, uploads artifacts, opens a PR with `benchmark-realistic-latest.*` for human merge. Not on every push/PR.
_Avoid_: direct Actions push to `main`; weekly schedule; running full realistic on PR CI

**Last verified (realistic)**:
Research page section + README table row / Last verified line read `proof` from committed `benchmark-realistic-latest.json`. Homepage stays UC1. Empty state: “Not verified yet” until first GHA proof PR merges.
_Avoid_: hard-coded dates; live Actions API; putting realistic numbers on the home chart

**Singleton service**:
A class instance on `globalThis`, created with a default constructor, registered via singular `registerPublicService` on import, configured later by plural `registerPublicServices(cfg)`.
_Avoid_: ambient auth tokens; Nest DI as the lab subject

**ESM stub package**:
A `@lab/esm-svc-*` (or smoke) package with named `used` / `unused*` exports; fixtures use `import * as SvcN` then `SvcN.used()` so unused exports can be shaken while keeping dotted call sites.
_Avoid_: requiring a full Next app to prove the delta

**Findings / docs site**:
`apps/docs` (`@apps/docs`): Fumadocs explainer (metrics home, why, run, research). Dark default + light; Nothing tokens. Home reads UC1 `benchmark-latest.json` only.
_Avoid_: product auth demo, identity Worker

**Lab package**:
Workspace packages under `packages/lab/*` (`@lab/singleton-services`, smoke, generated). Generated trees are gitignored; no Nx build targets on stubs.
_Avoid_: `@service/*` demo SDKs (removed)
