# Scale bench partial

- **When:** 2026-07-26T14:37:12.734Z
- **Case:** partial
- **N:** 100
- **Fns/svc:** 20
- **Surface:** 2000 functions (100 × 20)
- **Call sites (both arms):** 50: packages [5, 6, 7, 8, 9, 11, 15, 18, 19, 23, 24, 28, 30, 31, 32, 35, 37, 39, 40, 43, 45, 48, 49, 52, 53, 55, 56, 61, 62, 63, 67, 68, 70, 72, 73, 74, 75, 77, 81, 82, 84, 85, 86, 87, 89, 91, 93, 96, 98, 99]
- **Cycles:** false
- **Host:** esbuild
- **Mode:** generated

App needs 50 of 2000 surface functions (used() on 50 packages). Both arms call the same 50 sites; singleton still registers all 100 packages.

## Results

| Arm | Size | Build (ms) | Used markers | Unused retained |
|-----|------|----------:|-------------:|----------------:|
| Singleton | 4,243,770 B · 4144.3 KB · 4.05 MB | 83 | 100 | 1900 |
| ESM | 6,322 B · 6.2 KB | 18 | 50 | 0 |

## Benefit (percentage comparison)

| Metric | Value |
|--------|------:|
| Bytes saved vs singleton | 99.9% |
| Absolute saved | 4,237,448 B · 4138.1 KB · 4.04 MB |
| ESM as % of singleton | 0.15% |
| Singleton / ESM size | 671.3× |
| Call-site coverage of surface | 2.5% (50/2000) |
| Unused markers removed | 100% (Δ 1900) |

## Why this matters

Paying only for call sites keeps Worker/edge cold starts and deploy artifacts small. A GraphQL (or similar) façade that *could* reach all 100 packages still only needs the resolvers it wires: with ESM that is ~50 imports; a singleton registry that side-effect-imports all 100 still ships the full surface even when only 2.5% of functions are invoked.

## Commands

```bash
bun run lab:bench:smoke
bun run lab:bench -- --n=100
bun run lab:bench:wide -- --n=100
bun run lab:bench:cycles -- --n=100
bun run lab:bench:partial -- --n=100 --used=8
```
