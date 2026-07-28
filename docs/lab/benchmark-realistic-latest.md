# Scale bench realistic

- **When:** 2026-07-28T19:19:56.313Z
- **Case:** realistic
- **N:** 100
- **Fns/svc:** 20
- **Surface:** 2000 functions (100 × 20)
- **Call sites (both arms):** 1000: packages [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99]
- **Consumers:** 1
- **Cycles:** true
- **Host:** esbuild
- **Mode:** generated
- **3p:** real (4 pkgs)

Realistic GraphQL-shaped: cycles + --3p=real; app binds 1000 of 2000 surface functions (~10 call sites/pkg) across 100 packages. Both arms share the same call sites (no --seed shuffle). Singleton still registers all 100 packages; cycles may drag the full ring into ESM. Real npm core (graphql) is paid on both arms; unused SDK extras stay singleton-only.

> **Methodology limits:** Compare fair pairs only (singleton vs ESM within the same cache mode). Never average warm and cold into one score. Artifact byte/upload timings are a CI proxy — not a Cloudflare Workers deploy.

## Results

| Arm | Size | Build (ms) | Used markers | Unused retained | 3p markers |
|-----|------|----------:|-------------:|----------------:|-----------:|
| Singleton | 4,368,709 B · 4266.3 KB · 4.17 MB | 203 | 100 | 1900 | 4 |
| ESM | 2,033,506 B · 1985.8 KB · 1.94 MB | 135 | 100 | 900 | 1 |

## Benefit (percentage comparison)

| Metric | Value |
|--------|------:|
| Bytes saved vs singleton | 53.5% |
| Absolute saved | 2,335,203 B · 2280.5 KB · 2.23 MB |
| ESM as % of singleton | 46.55% |
| Singleton / ESM size | 2.1× |
| Call-site coverage of surface | 50% (1000/2000) |
| Unused markers removed | 52.6% (Δ 1000) |

## Third-party (real)

| | Count | Mode | Markers in singleton | Markers in ESM |
|--|------:|--------------------:|---------------------:|---------------:|
| Config | 4 | real npm | 4 | 1 |

- Shared core marker: `LAB_3P_REAL_CORE` (both arms when any domain pkg is imported)
- Unused extras: `LAB_3P_REAL_EXTRA_0`, `LAB_3P_REAL_EXTRA_1`, `LAB_3P_REAL_EXTRA_2` (singleton register only)

## Pipeline (fair pairs; never average warm/cold)

> Compare fair pairs only (singleton vs ESM within the same cache mode). Never average warm and cold into one score. Artifact byte/upload timings are a CI proxy — not a Cloudflare Workers deploy.


### Cold

| Arm | generate (ms) | install (ms) | bundle (ms) | artifact bytes | upload (ms) | pipeline total (ms) |
|-----|-------------:|-------------:|-----------:|---------------:|------------:|--------------------:|
| Singleton | 107 | 83 | 209 | 4,368,709 | — | 399 |
| ESM | 107 | 83 | 123 | 2,033,506 | — | 313 |


### Warm

| Arm | generate (ms) | install (ms) | bundle (ms) | artifact bytes | upload (ms) | pipeline total (ms) |
|-----|-------------:|-------------:|-----------:|---------------:|------------:|--------------------:|
| Singleton | 133 | 93 | 203 | 4,368,709 | — | 429 |
| ESM | 133 | 93 | 135 | 2,033,506 | — | 361 |


## Proof

| | |
|--|--|
| Timestamp | 2026-07-28T19:19:56.313Z |
| Runner | github-actions |
| GitHub run | https://github.com/atiq-playground/esm-treeshake-lab/actions/runs/30391454216 |
| Run id | 30391454216 |

## Request-time (Node HTTP)

> Fresh Node process per arm (isolated RSS/heap). Node HTTP on GitHub Actions / local is not a Cloudflare isolate boot and is not production gateway RPS. Relative arm comparison only.

| Arm | p50 (ms) | p95 (ms) | CPU user (ms) | CPU system (ms) | RSS | Heap |
|-----|---------:|---------:|--------------:|----------------:|----:|-----:|
| Singleton | 1.68 | 2.02 | 869.24 | 65.39 | 133,722,112 | 37,960,328 |
| ESM | 1.67 | 1.89 | 835.66 | 63.53 | 121,524,224 | 24,868,936 |

Warmup discarded: 50; measured: 1000; concurrency: 1. Fresh Node process per arm.

## Why this matters

Realistic GraphQL-shaped packaging: both arms bind the same 1000 call sites across 100 packages (cycles + real npm core). Singleton still registers the full graph; ESM pays for wired sites. Pipeline timings below compare fair pairs within one cache mode — never average warm and cold. Artifact upload is a CI proxy, not a Cloudflare deploy.

## Commands

```bash
bun run lab:bench:smoke
bun run lab:bench -- --n=100 --used=200
bun run lab:bench:wide -- --n=100 --used=300
bun run lab:bench:cycles -- --n=100 --used=300
bun run lab:bench:partial -- --n=100 --used=500
bun run lab:bench:thirdparty -- --n=100
bun run lab:bench:thirdparty:real -- --n=100
bun run lab:bench:fleet -- --n=50 --consumers=100
bun run lab:bench:realistic
bun run lab:bench:coldstart
```
