# Scale bench cycles

- **When:** 2026-07-26T15:28:01.879Z
- **Case:** cycles
- **N:** 100
- **Fns/svc:** 20
- **Surface:** 2000 functions (100 × 20)
- **Call sites (both arms):** 1: ESM imports only `used` from svc-0
- **Cycles:** true
- **Host:** esbuild
- **Mode:** generated

ESM call sites: 1 (import { used } from svc-0 only). Surface still 2000 fns across 100 packages; --fns only grows what can be shaken, not what ESM calls.

## Results

| Arm | Size | Build (ms) | Used markers | Unused retained |
|-----|------|----------:|-------------:|----------------:|
| Singleton | 4,249,009 B · 4149.4 KB · 4.05 MB | 89 | 100 | 1900 |
| ESM | 12,840 B · 12.5 KB · 0.01 MB | 110 | 1 | 0 |

## Benefit (percentage comparison)

| Metric | Value |
|--------|------:|
| Bytes saved vs singleton | 99.7% |
| Absolute saved | 4,236,169 B · 4136.9 KB · 4.04 MB |
| ESM as % of singleton | 0.3% |
| Singleton / ESM size | 330.9× |
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
