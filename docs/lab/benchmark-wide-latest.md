# Scale bench wide

- **When:** 2026-07-26T15:28:01.349Z
- **Case:** wide
- **N:** 100
- **Fns/svc:** 20
- **Surface:** 2000 functions (100 × 20)
- **Call sites (both arms):** 1: ESM imports only `used` from svc-0
- **Cycles:** false
- **Host:** esbuild
- **Mode:** generated

ESM call sites: 1 (import { used } from svc-0 only). Surface still 2000 fns across 100 packages; --fns only grows what can be shaken, not what ESM calls.

## Results

| Arm | Size | Build (ms) | Used markers | Unused retained |
|-----|------|----------:|-------------:|----------------:|
| Singleton | 4,241,406 B · 4142 KB · 4.04 MB | 69 | 100 | 1900 |
| ESM | 200 B | 5 | 1 | 0 |

## Benefit (percentage comparison)

| Metric | Value |
|--------|------:|
| Bytes saved vs singleton | 100% |
| Absolute saved | 4,241,206 B · 4141.8 KB · 4.04 MB |
| ESM as % of singleton | 0% |
| Singleton / ESM size | 21207× |
| Call-site coverage of surface | 0.05% (1/2000) |
| Unused markers removed | 100% (Δ 1900) |

## Why this matters

A singleton registry does not just import all 100 packages: it pulls every function inside them (cycles drag more). That graph does not tree-shake. ESM pays only for ~1 call sites (0.05% of the surface). Brutal when many consumers share the registry, or GraphQL sits on 100+ packages but only wires some resolvers. Cold start and deploy size follow the module graph, not the resolvers you actually registered.

## Commands

```bash
bun run lab:bench:smoke
bun run lab:bench -- --n=100
bun run lab:bench:wide -- --n=100
bun run lab:bench:cycles -- --n=100
bun run lab:bench:partial -- --n=100 --used=8
```
