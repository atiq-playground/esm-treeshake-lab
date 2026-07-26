# Scale bench baseline

- **When:** 2026-07-26T14:53:22.443Z
- **Case:** baseline
- **N:** 3
- **Fns/svc:** 2
- **Surface:** 6 functions (3 × 2)
- **Call sites (both arms):** 1: ESM imports only `used` from svc-0
- **Cycles:** false
- **Host:** esbuild
- **Mode:** smoke

ESM call sites: 1 (import { used } from svc-0 only). Surface still 6 fns across 3 packages; --fns only grows what can be shaken, not what ESM calls.

## Results

| Arm | Size | Build (ms) | Used markers | Unused retained |
|-----|------|----------:|-------------:|----------------:|
| Singleton | 8,337 B · 8.1 KB | 22 | 3 | 3 |
| ESM | 192 B | 2 | 1 | 0 |

## Benefit (percentage comparison)

| Metric | Value |
|--------|------:|
| Bytes saved vs singleton | 97.7% |
| Absolute saved | 8,145 B · 8 KB |
| ESM as % of singleton | 2.3% |
| Singleton / ESM size | 43.4× |
| Call-site coverage of surface | 16.67% (1/6) |
| Unused markers removed | 100% (Δ 3) |

## Why this matters

Paying only for call sites keeps Worker/edge cold starts and deploy artifacts small. A GraphQL (or similar) façade that *could* reach all 3 packages still only needs the resolvers it wires: with ESM that is ~1 imports; a singleton registry that side-effect-imports all 3 still ships the full surface even when only 16.67% of functions are invoked.

## Commands

```bash
bun run lab:bench:smoke
bun run lab:bench -- --n=100
bun run lab:bench:wide -- --n=100
bun run lab:bench:cycles -- --n=100
bun run lab:bench:partial -- --n=100 --used=8
```
