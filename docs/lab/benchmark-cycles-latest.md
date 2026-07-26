# Scale bench cycles

- **When:** 2026-07-26T15:48:25.600Z
- **Case:** cycles
- **N:** 100
- **Fns/svc:** 20
- **Surface:** 2000 functions (100 × 20)
- **Call sites (both arms):** 300: packages [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99]
- **Cycles:** true
- **Host:** esbuild
- **Mode:** generated

App binds 300 of 2000 surface functions across 100 packages. Both arms call the same 300 sites; singleton still registers all 100 packages (cycles may still drag the full ring into ESM).

## Results

| Arm | Size | Build (ms) | Used markers | Unused retained |
|-----|------|----------:|-------------:|----------------:|
| Singleton | 4,258,733 B · 4158.9 KB · 4.06 MB | 86 | 100 | 1900 |
| ESM | 467,053 B · 456.1 KB · 0.45 MB | 37 | 100 | 200 |

## Benefit (percentage comparison)

| Metric | Value |
|--------|------:|
| Bytes saved vs singleton | 89% |
| Absolute saved | 3,791,680 B · 3702.8 KB · 3.62 MB |
| ESM as % of singleton | 10.97% |
| Singleton / ESM size | 9.1× |
| Call-site coverage of surface | 15% (300/2000) |
| Unused markers removed | 89.5% (Δ 1700) |

## Why this matters

A singleton registry does not just import all 100 packages: it pulls every function inside them (cycles drag more). That graph does not tree-shake. ESM pays only for ~300 call sites (15% of the surface). Brutal when many consumers share the registry, or GraphQL sits on 100+ packages but only wires some resolvers. Cold start and deploy size follow the module graph, not the resolvers you actually registered.

## Commands

```bash
bun run lab:bench:smoke
bun run lab:bench -- --n=100 --used=20
bun run lab:bench:wide -- --n=100 --used=20
bun run lab:bench:cycles -- --n=100 --used=20
bun run lab:bench:partial -- --n=100 --used=200
```
