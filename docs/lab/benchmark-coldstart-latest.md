# Cold start / RSS (Node)

- **When:** 2026-07-28T02:28:34.639Z
- **N:** 50
- **Host:** Node (fresh process per arm)
- **Mode:** generated

Node cold import: wall time to first module evaluation + process RSS/heap after import. Fresh child process per arm. Workers/workerd isolate boot is not measured here (too heavy/noisy for the lab).

> **Methodology limits:** RSS includes Node baseline + V8 heap for the bundled graph — not a Cloudflare Worker isolate. Import ms is one-shot (no warmup average). Order-of-magnitude evidence that retained JS costs parse/memory, not a production SLO.

## Results

| Arm | Bundle | Import (ms) | RSS | Heap used |
|-----|--------|------------:|----:|----------:|
| Singleton | 131,678 B · 128.6 KB · 0.13 MB | 1.97 | 48,283,648 B · 47152 KB · 46.05 MB · 0.04 GB | 4,541,664 B · 4435.2 KB · 4.33 MB |
| ESM | 200 B | 0.33 | 47,185,920 B · 46080 KB · 45 MB · 0.04 GB | 4,207,976 B · 4109.4 KB · 4.01 MB |

## Benefit

| Metric | Value |
|--------|------:|
| Import time saved | 1.64 ms (83.2%) |
| RSS saved | 1,097,728 B · 1072 KB · 1.05 MB (2.3%) |

## Why this matters

Retained module graphs cost parse/compile time and resident memory, not just deploy bytes. This harness measures that on Node for the same singleton vs ESM fixtures the scale bench uses.

## Commands

```bash
bun run lab:bench:coldstart
bun run lab:bench:coldstart -- --n=3
```
