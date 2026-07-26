# ESM tree-shake lab

[![CI](https://github.com/atiq-playground/esm-treeshake-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/atiq-playground/esm-treeshake-lab/actions/workflows/ci.yml)
[![Bun](https://img.shields.io/badge/bun-1.3.14-fbf0df?logo=bun&logoColor=f472b6)](package.json)
[![License](https://img.shields.io/github/license/atiq-playground/esm-treeshake-lab)](LICENSE)

**What this is**  
A Nx + Bun lab that **measures** singleton-plugin packaging vs ESM selective imports (scale bench at N), and explains the numbers with **Fumadocs**.

**Focus**  
Metrics only: bytes, unused markers, build time. No auth / identity demo.

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

**Surface vs call sites:** `--fns` = functions *defined* per package. UC1–UC3 ESM still **calls 1** (`used` on svc-0). UC4 is “app needs K functions.”

| Case | Command | Surface / graph | ESM call sites | Report |
|------|---------|-----------------|----------------|--------|
| UC1 baseline | `lab:bench:smoke` / `lab:bench` | 2 fns/svc | **1** | `benchmark-latest.*` (home + CI) |
| UC2 wide | `lab:bench:wide -- --n=100` | `--fns=20` (or 40) | **1** | `benchmark-wide-latest.*` |
| UC3 cycles | `lab:bench:cycles -- --n=100` | wide + package ring | **1** (ring still pulls N modules) | `benchmark-cycles-latest.*` |
| UC4 partial | `lab:bench:partial -- --n=100 --used=8` | `--fns` surface; needs K | **K** (default `⌊N/2⌋`) | `benchmark-partial-latest.*` |

**Smoke (CI): UC1 only**

```bash
bun run lab:bench:smoke
```

**Full local**

```bash
bun run lab:bench -- --n=100
bun run lab:bench:wide -- --n=100
bun run lab:bench:cycles -- --n=100

# “We only needed 8 of the API surface”
bun run lab:bench:partial -- --n=100 --fns=40 --used=8

# optional: shuffle which K packages (reproducible)
bun run lab:bench:partial -- --n=100 --used=50 --seed=42

# optional stress (see docs/research/scale-bench-n1000-bun-esbuild.md)
bun run lab:bench -- --n=1000
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

## Map

Planning map (destination met): [Singleton vs ESM scale bench](https://github.com/atiq-playground/esm-treeshake-lab/issues/15).
