# Scale bench baseline

- **When:** 2026-07-26T15:48:24.707Z
- **Case:** baseline
- **N:** 100
- **Fns/svc:** 2
- **Surface:** 200 functions (100 × 2)
- **Call sites (both arms):** 200: packages [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99]
- **Cycles:** false
- **Host:** esbuild
- **Mode:** generated

App binds 200 of 200 surface functions across 100 packages. Both arms call the same 200 sites; singleton still registers all 100 packages.

## Results

| Arm | Size | Build (ms) | Used markers | Unused retained |
|-----|------|----------:|-------------:|----------------:|
| Singleton | 270,025 B · 263.7 KB · 0.26 MB | 67 | 100 | 100 |
| ESM | 235,410 B · 229.9 KB · 0.22 MB | 27 | 100 | 100 |

## Benefit (percentage comparison)

| Metric | Value |
|--------|------:|
| Bytes saved vs singleton | 12.8% |
| Absolute saved | 34,615 B · 33.8 KB · 0.03 MB |
| ESM as % of singleton | 87.18% |
| Singleton / ESM size | 1.1× |
| Call-site coverage of surface | 100% (200/200) |
| Unused markers removed | 0% (Δ 0) |

## Why this matters

A singleton registry does not just import all 100 packages: it pulls every function inside them (cycles drag more). That graph does not tree-shake. ESM pays only for ~200 call sites (100% of the surface). Brutal when many consumers share the registry, or GraphQL sits on 100+ packages but only wires some resolvers. Cold start and deploy size follow the module graph, not the resolvers you actually registered.

## Commands

```bash
bun run lab:bench:smoke
bun run lab:bench -- --n=100 --used=20
bun run lab:bench:wide -- --n=100 --used=20
bun run lab:bench:cycles -- --n=100 --used=20
bun run lab:bench:partial -- --n=100 --used=200
```
