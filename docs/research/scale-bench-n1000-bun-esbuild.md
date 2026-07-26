# Research: Bun + esbuild scale bench across N and use cases

- **Ticket:** [Research whether 1000 package workspaces stay practical under Bun/Nx](https://github.com/atiq-playground/esm-treeshake-lab/issues/24)
- **Map:** [Singleton vs ESM scale bench](https://github.com/atiq-playground/esm-treeshake-lab/issues/15)
- **Date:** 2026-07-26
- **Raw sweep:** [scale-bench-sweep.json](./scale-bench-sweep.json)

## Question

Across **N ∈ {3, 100, 1000, 2000, 5000, 10000}** and the lab’s four use cases, what are practical limits for generating stub packages and running the **esbuild-primary** harness (Next scale host dropped: [#28](https://github.com/atiq-playground/esm-treeshake-lab/issues/28))?

## Method

In-repo lab harness (not ephemeral `/tmp` workspaces):

1. Generate N singleton + ESM stub packages under `packages/lab/generated` (`scripts/lab/generate-scale-bench.ts`). Cap raised to **10000**.
2. Time `bun install` at the repo root. Generated stubs are **not** Bun workspace members; esbuild resolves `@lab/*` via the lab plugin. Install times therefore reflect lockfile refresh only, not linking 2N workspace packages.
3. Bundle each use-case entry with esbuild (`--bundle --format=esm`), measuring wall time, bytes, and unused markers.
4. Sweep driver: `bun run scripts/lab/probe-scale-practicality.ts` (restores `docs/lab/benchmark-*-latest.*` at N=100 afterward).

**Use cases (this N-ladder sweep)**

| Case | Surface | Graph | Call sites (both arms) |
|------|---------|-------|------------------------|
| **baseline** (UC1) | 2 fns/svc | no cycles | 1 (`used` on svc-0) |
| **wide** (UC2) | 20 fns/svc | no cycles | 1 |
| **partial** (UC4) | 20 fns/svc | no cycles | `min(8, N)` (fixed K for scale story) |
| **cycles** (UC3) | 20 fns/svc | ring import across all N | 1 call, but ring pulls N modules into ESM |

This sweep answers **“how far can N go?”** with a thin call-site model (mostly K=1). It is **not** the landing-page story.

### Landing-shaped benches (separate from this sweep)

Docs home / README measure a **GraphQL-like** service that can reach **N ≈ 100 first-party domain packages**, binding **~2–5 resolvers per package** (1 function ≈ 1 field resolver). Both arms call the same K; singleton still registers all N.

| Landing case | Command (N=100) | Surface | K (`--used`) |
|--------------|-----------------|---------|--------------|
| Lean (UC1) | `lab:bench -- --n=100 --used=200` | 2 fns/svc | 200 (~2/pkg) |
| Fat (UC2) | `lab:bench:wide -- --n=100 --used=300` | 20 fns/svc | 300 (~3/pkg) |
| Cyclic (UC3) | `lab:bench:cycles -- --n=100 --used=300` | 20 + ring | 300 (~3/pkg) |
| Many (UC4) | `lab:bench:partial -- --n=100 --used=500` | 20 fns/svc | 500 (~5/pkg) |

Artifacts: `docs/lab/benchmark-*-latest.*`. CI smoke stays UC1 N=3 with K=1. Re-running `lab:probe:scale` restores N=100 **sweep-shaped** (K=1 / K=min(8,N)) latest files unless you re-apply the landing `--used=` commands afterward.

Hardware: local WSL2 / Bun 1.3.14 (dev laptop). Numbers are order-of-magnitude, not CI SLOs. Sweep timestamp: `2026-07-26T15:27:58.959Z`.

## Results by use case

Times rounded; tree = `du -sb packages/lab/generated`. `gen=0` means the wide tree was reused for partial.

### UC1 baseline (fns=2)

| N | Gen (s) | `bun install` (s) | Tree | esbuild S / E (ms) | Bundle S / E | Unused markers S / E | Bytes saved |
|---|---------|-------------------|------|-------------------:|--------------|----------------------|-------------|
| 3 | 0.05 | 0.06 | 17KB | 15 / 2 | 8.4KB / 200B | 3 / 0 | 97.6% |
| 100 | 0.17 | 0.06 | 544KB | 35 / 2 | 257KB / 200B | 100 / 0 | 99.9% |
| 1000 | 1.39 | 0.07 | 5.3MB | 220 / 2 | 2.5MB / 200B | 1000 / 0 | ~100% |
| 2000 | 2.86 | 0.07 | 10.7MB | 369 / 3 | 5.1MB / 200B | 2000 / 0 | ~100% |
| 5000 | 7.01 | 0.06 | 26.7MB | 946 / 3 | 12.7MB / 200B | 5000 / 0 | ~100% |
| 10000 | 14.96 | 0.06 | 53.4MB | 1938 / 3 | 25.3MB / 200B | 10000 / 0 | ~100% |

### UC2 wide (fns=20)

| N | Gen (s) | `bun install` (s) | Tree | esbuild S / E (ms) | Bundle S / E | Unused markers S / E | Bytes saved |
|---|---------|-------------------|------|-------------------:|--------------|----------------------|-------------|
| 3 | 0.03 | 0.06 | 255KB | 8 / 3 | 125KB / 200B | 57 / 0 | 99.8% |
| 100 | 0.19 | 0.06 | 8.3MB | 50 / 2 | 4.0MB / 200B | 1900 / 0 | ~100% |
| 1000 | 1.63 | 0.06 | 82.9MB | 331 / 3 | 40.5MB / 200B | 19000 / 0 | ~100% |
| 2000 | 3.20 | 0.06 | 166MB | 615 / 3 | 81.0MB / 200B | 38000 / 0 | ~100% |
| 5000 | 8.28 | 0.06 | 415MB | 1864 / 6 | 202.5MB / 200B | 95000 / 0 | ~100% |
| 10000 | 16.90 | 0.07 | 829MB | 3317 / 5 | 405.1MB / 200B | 190000 / 0 | ~100% |

### UC4 partial (fns=20, K=`min(8,N)` call sites)

Same generated tree as wide. Singleton still registers all N; ESM pays only for K imports.

| N | Gen (s) | Tree | esbuild S / E (ms) | Bundle S / E | Used markers S / E | Bytes saved |
|---|---------|------|-------------------:|--------------|--------------------|-------------|
| 3 | 0 (reuse) | 255KB | 8 / 3 | 125KB / 463B | 3 / 3 | 99.6% |
| 100 | 0 (reuse) | 8.3MB | 44 / 5 | 4.0MB / 1.0KB | 100 / 8 | ~100% |
| 1000 | 0 (reuse) | 82.9MB | 313 / 4 | 40.5MB / 1.0KB | 1000 / 8 | ~100% |
| 2000 | 0 (reuse) | 166MB | 670 / 5 | 81.0MB / 1.0KB | 2000 / 8 | ~100% |
| 5000 | 0 (reuse) | 415MB | 2331 / 24 | 202.5MB / 1.0KB | 5000 / 8 | ~100% |
| 10000 | 0 (reuse) | 829MB | 2965 / 7 | 405.1MB / 1.0KB | 10000 / 8 | ~100% |

### UC3 cycles (fns=20 + package ring)

| N | Gen (s) | Tree | esbuild S / E (ms) | Bundle S / E | Unused markers S / E | Bytes saved |
|---|---------|------|-------------------:|--------------|----------------------|-------------|
| 3 | 0.03 | 256KB | 10 / 4 | 125KB / 528B | 57 / 0 | 99.6% |
| 100 | 0.20 | 8.3MB | 53 / 73 | 4.1MB / 12.5KB | 1900 / 0 | 99.7% |
| 1000 | 1.64 | 83.4MB | 340 / 697 | 40.6MB / 125KB | 19000 / 0 | 99.7% |
| 2000 | 3.23 | 167MB | 830 / 1261 | 81.1MB / 251KB | 38000 / 0 | 99.7% |
| 5000 | 8.54 | 417MB | 3315 / 3442 | 202.9MB / 629KB | 95000 / 0 | 99.7% |
| 10000 | 16.99 | 834MB | **22085** / 6594 | 405.8MB / 1.23MB | 190000 / 0 | 99.7% |

## Cross-cutting notes

- **`bun install` stays ~60ms** at every N in this layout because generated packages are resolution-only (plugin paths), not workspace members. That is intentional (see Nx guidance below). Do **not** treat these install numbers as “Bun can link 20k workspace packages in 60ms.”
- **Generation** is the first real cost: ~15–17s and ~50–830MB on disk at N=10000 (baseline vs wide). Still laptop-practical as an optional stress flag.
- **ESM without cycles** stays tiny and fast (hundreds of bytes, single-digit ms) even at N=10000 when the entry imports one (or eight) packages.
- **Cycles are the ESM cliff:** the ring forces esbuild to visit all N modules. At N=10000, ESM is ~1.2MB / ~6.6s; singleton climbs to ~22s. Savings stay ~99.7% vs singleton, but wall time stops feeling interactive.
- **Wide/partial singleton size** scales with N × fns (~40MB at N=1000, ~405MB at N=10000). That is the product-story cost of a registry that side-effect-imports everything.
- Side-effect imports are required for the singleton arm to retain modules; pure `import { used }` of one package matches the ESM arm (both shake). Cycles need a real top-level side effect on the ring edge or esbuild DCE’s the cycle.

## Nx

Not stress-tested with a full `nx` graph of 2000+ projects. Expect:

- **Risk:** registering every generated package as an Nx project with `build`/`typecheck` will dominate graph compute and CI `run-many`.
- **Mitigation (lab default):** generated packages are **workspace packages for resolution only**: no per-package Nx targets; only scripts (`lab:generate`, `lab:bench`, `lab:probe:scale`) and `@apps/docs` are Nx-relevant. Smoke N=3 may be listed if useful; N≥100 generated trees stay gitignored and outside `nx run-many -t build`.

## Next.js

Out of scope for scale metrics after [#28](https://github.com/atiq-playground/esm-treeshake-lab/issues/28). Do not use Next wall time as a gate for large N.

## Guidance for the lab

| N | Guidance |
|---|----------|
| **3** | Always: CI smoke (UC1) |
| **100** | Default local full bench for all four use cases |
| **1000** | Comfortable stress on a laptop for all UCs; sub-second singleton esbuild except cycles ESM (~0.7s) |
| **2000** | Supported optional stress; wide singleton ~81MB / ~0.6–0.8s |
| **5000** | Optional extreme: gen ~8s, wide tree ~415MB, singleton esbuild ~2s; cycles both arms ~3s |
| **10000** | Extreme only: gen ~17s, wide tree ~830MB, singleton ~3s (wide) / **~22s** (cycles). Not for CI. Prefer smaller N unless measuring the cliff. |

## Re-run

```bash
bun run lab:probe:scale
# or a subset:
bun run scripts/lab/probe-scale-practicality.ts --n=3,100,1000
```

## Answer

**N=1000 remains practical** for all four use cases under the esbuild harness when generated packages are not Bun/Nx project targets. **N=100** stays the documented default. **N=2000–5000** are usable optional stress points; **N=10000** works but is disk- and (for cycles) wall-time heavy—treat as an extreme probe, not a day-to-day flag. The binding constraints are **singleton bundle size**, **generated tree disk**, and **cycles ESM/singleton wall time**, not `bun install` in the current resolution-only layout.

For product messaging, prefer the **landing-shaped** N=100 / `--used≈2–5 per package` benches (honest GraphQL bind density). Use this N-ladder for **harness practicality**, not as the headline “% saved” story.
