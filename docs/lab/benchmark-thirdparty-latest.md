# Scale bench thirdparty

- **When:** 2026-07-28T02:27:56.830Z
- **Case:** thirdparty
- **N:** 100
- **Fns/svc:** 2
- **Surface:** 200 functions (100 × 2)
- **Call sites (both arms):** 1: ESM imports only `used` from svc-0
- **Consumers:** 1
- **Cycles:** false
- **Host:** esbuild
- **Mode:** generated
- **3p:** stub (4 pkgs)

Third-party ballast (stubs, not real npm): every domain package side-effect-imports @lab/3p-core; the singleton register also imports 3 unused @lab/3p-extra-* modules (~32768 B ballast each). Shared core is paid on both arms; unused extras stay singleton-only. Use --3p=real for pinned graphql-stack npm weight.

> **Methodology limits:** 3p packages are generated stubs with fixed ballast + side-effect touches. They approximate unused SDK weight. Pass --3p=real for pinned npm graphql-stack weight.

## Results

| Arm | Size | Build (ms) | Used markers | Unused retained | 3p markers |
|-----|------|----------:|-------------:|----------------:|-----------:|
| Singleton | 395,274 B · 386 KB · 0.38 MB | 49 | 100 | 100 | 4 |
| ESM | 33,191 B · 32.4 KB · 0.03 MB | 3 | 1 | 0 | 1 |

## Benefit (percentage comparison)

| Metric | Value |
|--------|------:|
| Bytes saved vs singleton | 91.6% |
| Absolute saved | 362,083 B · 353.6 KB · 0.35 MB |
| ESM as % of singleton | 8.4% |
| Singleton / ESM size | 11.9× |
| Call-site coverage of surface | 0.5% (1/200) |
| Unused markers removed | 100% (Δ 100) |

## Third-party (stub)

| | Count | Bytes/pkg (ballast) | Markers in singleton | Markers in ESM |
|--|------:|--------------------:|---------------------:|---------------:|
| Config | 4 | 32,768 | 4 | 1 |

- Shared core marker: `LAB_3P_CORE` (both arms when any domain pkg is imported)
- Unused extras: `LAB_3P_EXTRA_0`, `LAB_3P_EXTRA_1`, `LAB_3P_EXTRA_2` (singleton register only)

## Why this matters

Shared third-party runtime (stub core) is paid either way. The registry still ships unused 3p extras plus every first-party package. Pass --3p=real for pinned npm graphs; the first-party + unused-SDK gap remains the packaging choice.

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
