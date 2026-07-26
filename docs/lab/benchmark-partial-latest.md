# Scale bench partial

- **When:** 2026-07-26T15:48:26.058Z
- **Case:** partial
- **N:** 100
- **Fns/svc:** 20
- **Surface:** 2000 functions (100 × 20)
- **Call sites (both arms):** 500: packages [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99]
- **Cycles:** false
- **Host:** esbuild
- **Mode:** generated

App binds 500 of 2000 surface functions across 100 packages. Both arms call the same 500 sites; singleton still registers all 100 packages.

## Results

| Arm | Size | Build (ms) | Used markers | Unused retained |
|-----|------|----------:|-------------:|----------------:|
| Singleton | 4,256,114 B · 4156.4 KB · 4.06 MB | 90 | 100 | 1900 |
| ESM | 906,344 B · 885.1 KB · 0.86 MB | 38 | 100 | 400 |

## Benefit (percentage comparison)

| Metric | Value |
|--------|------:|
| Bytes saved vs singleton | 78.7% |
| Absolute saved | 3,349,770 B · 3271.3 KB · 3.19 MB |
| ESM as % of singleton | 21.3% |
| Singleton / ESM size | 4.7× |
| Call-site coverage of surface | 25% (500/2000) |
| Unused markers removed | 78.9% (Δ 1500) |

## Why this matters

A singleton registry does not just import all 100 packages: it pulls every function inside them (cycles drag more). That graph does not tree-shake. ESM pays only for ~500 call sites (25% of the surface). Brutal when many consumers share the registry, or GraphQL sits on 100+ packages but only wires some resolvers. Cold start and deploy size follow the module graph, not the resolvers you actually registered.

## Commands

```bash
bun run lab:bench:smoke
bun run lab:bench -- --n=100 --used=20
bun run lab:bench:wide -- --n=100 --used=20
bun run lab:bench:cycles -- --n=100 --used=20
bun run lab:bench:partial -- --n=100 --used=200
```
