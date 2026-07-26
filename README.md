# ESM tree-shake lab

[![CI](https://github.com/atiq-playground/esm-treeshake-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/atiq-playground/esm-treeshake-lab/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/atiq-playground/esm-treeshake-lab?label=release)](https://github.com/atiq-playground/esm-treeshake-lab/releases/tag/v0.3.0)
[![Bun](https://img.shields.io/badge/bun-1.3.14-fbf0df?logo=bun&logoColor=f472b6)](package.json)
[![License](https://img.shields.io/github/license/atiq-playground/esm-treeshake-lab)](LICENSE)

**What this is**  
A Nx + Bun lab that **measures** singleton-plugin packaging vs ESM selective imports (scale bench at N), and explains the numbers with **Fumadocs**.

**Focus**  
Metrics only: bytes, unused markers, build time. No auth / identity demo.

**If this helped you, drop a [follow](https://github.com/noonii) and a [star on GitHub](https://github.com/atiq-playground/esm-treeshake-lab)! I would really appreciate it.**

[![Star on GitHub](https://img.shields.io/github/stars/atiq-playground/esm-treeshake-lab?style=social)](https://github.com/atiq-playground/esm-treeshake-lab)

## Layout

| Path | Role |
|------|------|
| `apps/docs` | Fumadocs site (metrics, why, run, research) |
| `packages/lab/*` | `@lab/singleton-services`, smoke stubs, generated stubs |
| `scripts/lab/*` | generate + esbuild bench |
| `docs/lab/benchmark-*.latest.*` | Case reports (UC1 = `benchmark-latest.*`) |

## Getting started

```bash
bun install
bun run lab:bench:smoke
bun run dev          # docs at http://localhost:3000
```

## Scale bench

Compares **global singleton plugins** (import all N → register) vs **ESM** (import only what you call). Host: **esbuild**.

**Surface vs call sites:** `--fns` = functions *defined* per package. `--used=K` = resolvers bound (1 fn ≈ 1 field). Landing uses ~2–5/pkg, not a single toy import.

| Case | Command | Surface / graph | ESM call sites | Report |
|------|---------|-----------------|----------------|--------|
| UC1 baseline | `lab:bench:smoke` / `lab:bench -- --n=100 --used=200` | 2 fns/svc | **K** (landing **~2/pkg**; smoke **1**) | `benchmark-latest.*` (home + CI) |
| UC2 wide | `lab:bench:wide -- --n=100 --used=300` | `--fns=20` | **K** (landing **~3/pkg**) | `benchmark-wide-latest.*` |
| UC3 cycles | `lab:bench:cycles -- --n=100 --used=300` | wide + package ring | **K** (landing **~3/pkg**) | `benchmark-cycles-latest.*` |
| UC4 partial | `lab:bench:partial -- --n=100 --used=500` | `--fns` surface; needs K | **K** (landing **~5/pkg**) | `benchmark-partial-latest.*` |

**Smoke (CI): UC1 only**

```bash
bun run lab:bench:smoke
```

**Full local (landing-shaped: ~2–5 resolvers per domain package)**

```bash
# 1 fn ≈ 1 GraphQL field resolver
bun run lab:bench -- --n=100 --used=200          # ~2/pkg (lean surface)
bun run lab:bench:wide -- --n=100 --used=300     # ~3/pkg of ~20
bun run lab:bench:cycles -- --n=100 --used=300
bun run lab:bench:partial -- --n=100 --used=500  # ~5/pkg of ~20

# optional: shuffle which K surface fns (reproducible)
bun run lab:bench:partial -- --n=100 --used=500 --seed=42

# optional stress ladder (see docs/research/scale-bench-n1000-bun-esbuild.md)
bun run lab:bench -- --n=1000
# full N × use-case practicality sweep → docs/research/scale-bench-sweep.json
bun run lab:probe:scale
```

Variants never overwrite `benchmark-latest.*` (docs home stays on UC1).

**Outputs**

| Output | Use |
|--------|-----|
| Terminal report | Screenshot-friendly summary |
| `docs/lab/benchmark-latest.*` | UC1: home + PRs |
| `docs/lab/benchmark-wide-latest.*` | UC2 |
| `docs/lab/benchmark-cycles-latest.*` | UC3 |
| `docs/lab/benchmark-partial-latest.*` | UC4 |

## Scripts

| Script | What it does |
|--------|----------------|
| `dev` | Fumadocs (`@apps/docs`) |
| `build` | Next build docs |
| `preview` | OpenNext build + local Workers runtime |
| `deploy` | OpenNext build + deploy to Cloudflare Workers |
| `lab:generate` | Generate N singleton + ESM stub packages |
| `lab:bench:smoke` | UC1 N=3 scale bench (CI) |
| `lab:bench` | UC1 full scale bench (default N=100) |
| `lab:bench:wide` | UC2: many fns/svc defined (ESM still calls 1) |
| `lab:bench:cycles` | UC3: wide + cyclic package ring |
| `lab:bench:partial` | UC4: both arms call `--used=K` sites |
| `lab:probe:scale` | N × UC practicality sweep → `docs/research/scale-bench-sweep.json` |

## Map

Planning map (destination met): [Singleton vs ESM scale bench](https://github.com/atiq-playground/esm-treeshake-lab/issues/15).

## Support

If this helped you, drop a [follow](https://github.com/noonii) and a [star on GitHub](https://github.com/atiq-playground/esm-treeshake-lab)! I would really appreciate it.
