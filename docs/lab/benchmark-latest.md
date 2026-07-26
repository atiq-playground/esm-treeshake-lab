# Scale bench baseline

- **When:** 2026-07-26T15:28:00.963Z
- **Case:** baseline
- **N:** 100
- **Fns/svc:** 2
- **Surface:** 200 functions (100 × 2)
- **Call sites (both arms):** 1: ESM imports only `used` from svc-0
- **Cycles:** false
- **Host:** esbuild
- **Mode:** generated

ESM call sites: 1 (import { used } from svc-0 only). Surface still 200 fns across 100 packages; --fns only grows what can be shaken, not what ESM calls.

## Results

| Arm | Size | Build (ms) | Used markers | Unused retained |
|-----|------|----------:|-------------:|----------------:|
| Singleton | 262,986 B · 256.8 KB · 0.25 MB | 47 | 100 | 100 |
| ESM | 200 B | 2 | 1 | 0 |

## Benefit (percentage comparison)

| Metric | Value |
|--------|------:|
| Bytes saved vs singleton | 99.9% |
| Absolute saved | 262,786 B · 256.6 KB · 0.25 MB |
| ESM as % of singleton | 0.08% |
| Singleton / ESM size | 1314.9× |
| Call-site coverage of surface | 0.5% (1/200) |
| Unused markers removed | 100% (Δ 100) |

## Why this matters

A singleton registry does not just import all 100 packages: it pulls every function inside them (cycles drag more). That graph does not tree-shake. ESM pays only for ~1 call sites (0.5% of the surface). Brutal when many consumers share the registry, or GraphQL sits on 100+ packages but only wires some resolvers. Cold start and deploy size follow the module graph, not the resolvers you actually registered.

## Commands

```bash
bun run lab:bench:smoke
bun run lab:bench -- --n=100
bun run lab:bench:wide -- --n=100
bun run lab:bench:cycles -- --n=100
bun run lab:bench:partial -- --n=100 --used=8
```
