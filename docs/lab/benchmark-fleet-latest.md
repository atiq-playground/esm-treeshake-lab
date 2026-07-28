# Scale bench fleet

- **When:** 2026-07-28T02:28:14.278Z
- **Case:** fleet
- **N:** 50
- **Fns/svc:** 2
- **Surface:** 100 functions (50 × 2)
- **Call sites (both arms):** 1: ESM imports only `used` from svc-0
- **Consumers:** 100 (fleet-mode=both)
- **Cycles:** false
- **Host:** esbuild
- **Mode:** generated

Multi-consumer / non-GraphQL framing: 100 identical frontend apps (or services). Naive fleet totals = per-consumer × M (each app pays the graph again). Also measured: one esbuild multi-entry (splitting) across M entries so shared modules are not naively ×M (singleton shared saves 98.8% vs naive ×M). Story is React/SDK consumers, not GraphQL resolvers.

> **Methodology limits:** Naive fleet totals multiply one measured consumer graph by M. Shared mode bundles M esbuild entries with code-splitting so common modules are counted once. Ignores CDN caches and per-app bind differences. Not a Workers isolate boot.

## Results

| Arm | Size | Build (ms) | Used markers | Unused retained | 3p markers |
|-----|------|----------:|-------------:|----------------:|-----------:|
| Singleton | 131,678 B · 128.6 KB · 0.13 MB | 33 | 50 | 50 | 0 |
| ESM | 200 B | 2 | 1 | 0 | 0 |

## Benefit (percentage comparison)

| Metric | Value |
|--------|------:|
| Bytes saved vs singleton | 99.8% |
| Absolute saved | 131,478 B · 128.4 KB · 0.13 MB |
| ESM as % of singleton | 0.15% |
| Singleton / ESM size | 658.4× |
| Call-site coverage of surface | 1% (1/100) |
| Unused markers removed | 100% (Δ 50) |

## Fleet (×100 consumers, mode=both)

| | Per consumer | Naive ×100 |
|--|-------------:|--------------------------:|
| Singleton | 131,678 B · 128.6 KB · 0.13 MB | 13,167,800 B · 12859.2 KB · 12.56 MB · 0.01 GB |
| ESM | 200 B | 20,000 B · 19.5 KB · 0.02 MB |
| Saved | 131,478 B · 128.4 KB · 0.13 MB (99.8%) | 13,147,800 B · 12839.6 KB · 12.54 MB · 0.01 GB (99.8%) |

### Shared multi-entry (esbuild splitting)

| | Multi-entry total | Chunks |
|--|------------------:|-------:|
| Singleton | 158,834 B · 155.1 KB · 0.15 MB | 101 |
| ESM | 16,400 B · 16 KB · 0.02 MB | 101 |
| Saved | 142,434 B · 139.1 KB · 0.14 MB (89.7%) | |

Naive→shared singleton savings: **98.8%** (shared modules counted once).


## Why this matters

Each of 100 consumers that imports the registry/SDK barrel pays the full first-party graph again under naive ×M. Selective ESM keeps per-app cost near the call sites you bind. Multi-entry shared mode shows how much a monorepo/shared-chunk build recovers for the singleton arm — ESM was already near the call-site floor.

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
