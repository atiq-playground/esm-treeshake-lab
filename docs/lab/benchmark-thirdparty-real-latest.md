# Scale bench thirdparty

- **When:** 2026-07-28T02:28:13.982Z
- **Case:** thirdparty
- **N:** 100
- **Fns/svc:** 2
- **Surface:** 200 functions (100 × 2)
- **Call sites (both arms):** 1: ESM imports only `used` from svc-0
- **Consumers:** 1
- **Cycles:** false
- **Host:** esbuild
- **Mode:** generated
- **3p:** real (4 pkgs)

Third-party ballast (real pinned npm): every domain package side-effect-imports @lab/3p-core → graphql; the singleton register also imports 3 unused extras (dataloader / graphql-tag / uuid wrappers). Shared core is paid on both arms; unused extras stay singleton-only. Versions pinned in package.json/lockfile for CI reproducibility.

> **Methodology limits:** Real npm path pins graphql + dataloader + graphql-tag + uuid. esbuild bundles their reachable graphs; CJS interop and peer trees still differ from production Workers installs. Stub path remains default for byte-floor CI.

## Results

| Arm | Size | Build (ms) | Used markers | Unused retained | 3p markers |
|-----|------|----------:|-------------:|----------------:|-----------:|
| Singleton | 355,478 B · 347.1 KB · 0.34 MB | 68 | 100 | 100 | 4 |
| ESM | 2,484 B · 2.4 KB | 15 | 1 | 0 | 1 |

## Benefit (percentage comparison)

| Metric | Value |
|--------|------:|
| Bytes saved vs singleton | 99.3% |
| Absolute saved | 352,994 B · 344.7 KB · 0.34 MB |
| ESM as % of singleton | 0.7% |
| Singleton / ESM size | 143.1× |
| Call-site coverage of surface | 0.5% (1/200) |
| Unused markers removed | 100% (Δ 100) |

## Third-party (real)

| | Count | Mode | Markers in singleton | Markers in ESM |
|--|------:|--------------------:|---------------------:|---------------:|
| Config | 4 | real npm | 4 | 1 |

- Shared core marker: `LAB_3P_REAL_CORE` (both arms when any domain pkg is imported)
- Unused extras: `LAB_3P_REAL_EXTRA_0`, `LAB_3P_REAL_EXTRA_1`, `LAB_3P_REAL_EXTRA_2` (singleton register only)

## Why this matters

Shared graphql (real core) is paid either way once a domain package is imported. The registry still ships unused SDK extras (dataloader / graphql-tag / uuid) plus every first-party package. Absolute bytes include real npm graphs; the packaging gap remains the unused-extra + first-party registry choice.

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
bun run lab:bench:coldstart
```
