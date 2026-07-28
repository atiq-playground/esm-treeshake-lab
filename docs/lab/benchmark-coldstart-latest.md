# Cold start / RSS (Node)

- **When:** 2026-07-28T02:47:21.322Z
- **N:** 50
- **Host:** Node (fresh process per arm)
- **Mode:** generated

Node cold import: wall time to first module evaluation + process RSS/heap after import. esbuild finishes before the clock; each arm times import of one already-bundled .mjs in a fresh child process. Workers/workerd isolate boot is not measured here (too heavy/noisy for the lab).

> **Methodology limits:** RSS includes ~45 MB Node baseline + V8 heap for the bundled graph — not a Cloudflare Worker isolate. Published latest uses research N=50 (smoke --n=3 is CI-local only and does not overwrite this artifact). Import ms is one-shot (no warmup average). Order-of-magnitude evidence that retained JS costs parse/memory, not a production SLO.

## Results

| Arm | Bundle | Import (ms) | RSS | Heap used |
|-----|--------|------------:|----:|----------:|
| Singleton | 131,678 B · 128.6 KB · 0.13 MB | 1.9 | 48,283,648 B · 47152 KB · 46.05 MB · 0.04 GB | 4,541,664 B · 4435.2 KB · 4.33 MB |
| ESM | 200 B | 0.34 | 47,235,072 B · 46128 KB · 45.05 MB · 0.04 GB | 4,207,976 B · 4109.4 KB · 4.01 MB |

## Benefit

| Metric | Value |
|--------|------:|
| Import time saved | 1.56 ms (82.1%) |
| RSS saved | 1,048,576 B · 1024 KB · 1 MB (2.2%) |

## Why this matters

Retained module graphs cost parse/compile time and resident memory, not just deploy bytes. This harness measures that on Node for the same singleton vs ESM fixtures the scale bench uses.

## Commands

```bash
bun run lab:bench:coldstart
bun run lab:bench:coldstart -- --n=3
```
