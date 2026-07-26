# Scale bench partial

- **When:** 2026-07-26T15:28:02.289Z
- **Case:** partial
- **N:** 100
- **Fns/svc:** 20
- **Surface:** 2000 functions (100 × 20)
- **Call sites (both arms):** 8: packages [0, 1, 2, 3, 4, 5, 6, 7]
- **Cycles:** false
- **Host:** esbuild
- **Mode:** generated

App needs 8 of 2000 surface functions (used() on 8 packages). Both arms call the same 8 sites; singleton still registers all 100 packages.

## Results

| Arm | Size | Build (ms) | Used markers | Unused retained |
|-----|------|----------:|-------------:|----------------:|
| Singleton | 4,241,742 B · 4142.3 KB · 4.05 MB | 73 | 100 | 1900 |
| ESM | 1,068 B · 1 KB | 6 | 8 | 0 |

## Benefit (percentage comparison)

| Metric | Value |
|--------|------:|
| Bytes saved vs singleton | 100% |
| Absolute saved | 4,240,674 B · 4141.3 KB · 4.04 MB |
| ESM as % of singleton | 0.03% |
| Singleton / ESM size | 3971.7× |
| Call-site coverage of surface | 0.4% (8/2000) |
| Unused markers removed | 100% (Δ 1900) |

## Why this matters

A singleton registry does not just import all 100 packages: it pulls every function inside them (cycles drag more). That graph does not tree-shake. ESM pays only for ~8 call sites (0.4% of the surface). Brutal when many consumers share the registry, or GraphQL sits on 100+ packages but only wires some resolvers. Cold start and deploy size follow the module graph, not the resolvers you actually registered.

## Commands

```bash
bun run lab:bench:smoke
bun run lab:bench -- --n=100
bun run lab:bench:wide -- --n=100
bun run lab:bench:cycles -- --n=100
bun run lab:bench:partial -- --n=100 --used=8
```
