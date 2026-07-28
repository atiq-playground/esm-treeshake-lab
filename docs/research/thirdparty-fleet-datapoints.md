# Research: third-party ballast + multi-consumer fleet + cold start

- **Date:** 2026-07-28
- **Artifacts:**
  - [benchmark-thirdparty-latest](../lab/benchmark-thirdparty-latest.md) (stub)
  - [benchmark-thirdparty-real-latest](../lab/benchmark-thirdparty-real-latest.md) (pinned npm)
  - [benchmark-fleet-latest](../lab/benchmark-fleet-latest.md) (naive ×M + shared multi-entry)
  - [benchmark-coldstart-latest](../lab/benchmark-coldstart-latest.md) (Node import + RSS)
- **Harness:** `scripts/lab/generate-scale-bench.ts` + `run-scale-bench.ts` + `run-coldstart-bench.ts`

## Why these cases exist

UC1–UC4 isolate the **first-party** module graph (GraphQL-shaped framing on the docs home). Three pressures sit outside that story:

1. **Third-party weight** — real services also pull SDKs; unused plugin barrels add ballast the registry ships.
2. **Many consumers** — the tax is not only one GraphQL Worker; hundreds of frontend apps / services may each import the same registry or SDK barrel — or share chunks in one multi-entry build.
3. **Cold start / memory** — retained JS costs parse time and resident memory, not only deploy bytes.

## Method

### `--case=thirdparty` (default `--3p=stub`)

- Generate N first-party stubs as usual (default `fns=2`).
- Generate deterministic `@lab/3p-*` stubs (not real npm packages):
  - `@lab/3p-core` — side-effect-imported by **every** domain package (shared runtime analogue).
  - `@lab/3p-extra-*` — side-effect-imported only by the **singleton register** (unused SDK surface).
- Each stub embeds fixed ballast (`--3p-bytes`, default 32768) plus a top-level `globalThis` touch so esbuild retains the module.
- Defaults: `--3p-count=4` (1 core + 3 extras).
- Report: `docs/lab/benchmark-thirdparty-latest.*` (never overwrites UC1).

### `--case=thirdparty --3p=real`

- Same wiring, but wrappers side-effect-import **pinned** npm packages (lockfile):
  - core → `graphql@16.11.0`
  - extras → `dataloader@2.2.3`, `graphql-tag@2.12.6`, `uuid@11.1.0`
- esbuild uses `mainFields: ["module","main"]` so CJS packages resolve under `platform: "neutral"`.
- Report: `docs/lab/benchmark-thirdparty-real-latest.*` (sibling; default stub path unchanged).

### `--case=fleet` (`--fleet-mode=naive|shared|both`, default `both`)

- Measure one consumer (baseline-shaped graph, default `n=50`, `callSites=1`).
- **Naive:** scale bytes by `--consumers=M` (default 100): `fleet.naive = perConsumer × M`.
- **Shared:** bundle **M entry points** in one esbuild multi-entry build with `splitting: true`; sum chunk bytes so shared modules are not naively multiplied.
- Framing: React apps / shared plugin SDK, not GraphQL resolvers.
- Report: `docs/lab/benchmark-fleet-latest.*` (includes both when `both`).

### `lab:bench:coldstart`

- Bundle singleton vs ESM fixtures, then spawn a **fresh Node process** per arm.
- Capture wall time to first module evaluation + `process.memoryUsage()` RSS/heap.
- **Default N=50** (publishes `docs/lab/benchmark-coldstart-latest.*`). Smoke override: `--n=3` (writes `tmp/` only).
- **Not measured:** workerd/miniflare isolate boot (too heavy/noisy for this lab).
- Report: `docs/lab/benchmark-coldstart-latest.*` (research-scale only).

## Commands

```bash
bun run lab:bench:thirdparty -- --n=100
bun run lab:bench:thirdparty -- --n=3 --3p-count=2 --3p-bytes=2048
bun run lab:bench:thirdparty:real -- --n=100
bun run lab:bench:thirdparty:real -- --n=3 --3p-count=2
bun run lab:bench:fleet -- --n=50 --consumers=100
bun run lab:bench:fleet -- --n=3 --consumers=10 --fleet-mode=both
bun run lab:bench:coldstart
bun run lab:bench:coldstart -- --n=3
```

## Sample numbers (this machine)

### Tiny check

| Case | Config | Singleton | ESM | Saved / note |
|------|--------|----------:|----:|------|
| thirdparty stub | N=3, 3p=2×2048 B | 12.6 KB | 2.4 KB | 80.9% |
| thirdparty real | N=3, 3p=2 | ~604 KB | ~586 KB | unused dataloader delta (~17 KB); shared graphql dominates |
| fleet | N=3, M=10, both | naive 81.6 KB / shared 10.7 KB | 2 KB / 1.7 KB | shared −86.9% vs naive singleton |
| coldstart | N=3 smoke | import ~0.5 ms | ~0.4 ms | RSS delta ≈ Node noise |

### Research defaults

| Case | Config | Singleton | ESM | Notes |
|------|--------|----------:|----:|-------|
| thirdparty stub | N=100, 3p=4×32 KB | 386 KB | 32.4 KB | 91.6% saved; extras only on singleton |
| thirdparty real | N=100, 3p=4 pinned | 347.1 KB | 2.4 KB | 99.3%; tree-shakeable graphql core stays tiny on ESM; unused SDK extras + first-party registry on singleton |
| fleet naive | N=50, M=100 | **12.56 MB** | **19.5 KB** | 99.8% across consumers |
| fleet shared | same | **155.1 KB** | **16 KB** | 98.8% less singleton than naive ×M |
| coldstart | N=50 Node | 1.97 ms · ~46 MB RSS | 0.33 ms · ~45 MB RSS | 83% faster import; ~1 MB RSS Δ (Node baseline dominates absolute RSS) |

## Methodology limits (honest)

- **Stub 3p ≠ real deps**, but **`--3p=real` is real pinned npm** (graphql stack + common SDK weight). Still not a full production peer tree, native addons, or Workers-specific bundler settings.
- **Shared core is paid on both arms** once any domain package is imported. The differential is unused extras + first-party registry weight.
- **Fleet naive is multiplication**; **fleet shared is measured multi-entry**. Neither models CDN caches or per-app bind differences.
- **Cold start is Node**, not workerd isolate boot. Absolute RSS includes ~45 MB Node baseline; use import ms + RSS Δ as the signal. Published latest is research N=50 (smoke `--n=3` → tmp only).
- **CI:** `lab:bench:smoke` stays UC1 N=3 asserts and does **not** overwrite `docs/lab` latest. Extended benches are local/research (optional light N=3 checks are fine for thirdparty/fleet).

## Suggested next steps

| Goal | Suggestion |
|------|------------|
| CI optional | `lab:bench:thirdparty -- --n=3 --3p-count=2 --3p-bytes=2048` + `lab:bench:fleet -- --n=3 --consumers=10` + `lab:bench:coldstart -- --n=3` (not required for merge; smoke paths do not publish latest). |
| Research | Local: `lab:bench:thirdparty:real -- --n=100`; fleet `--fleet-mode=both`; coldstart (default N=50). Growth ladder: UC1 `--n=500|1000`. |
| Workers | Separate isolate-boot harness (miniflare/workerd) if someone needs Worker-shaped RSS — out of scope for current CI budget. |
