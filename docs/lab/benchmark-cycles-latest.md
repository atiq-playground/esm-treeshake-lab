# Scale bench cycles

- **When:** 2026-07-26T14:29:30.833Z
- **Case:** cycles
- **N:** 100
- **Fns/svc:** 20
- **Cycles:** true
- **Host:** esbuild
- **Mode:** generated

## Results

| Arm | Size | Build (ms) | Used markers | Unused retained |
|-----|------|----------:|-------------:|----------------:|
| Singleton | 4,249,009 B · 4149.4 KB · 4.05 MB | 66 | 100 | 1900 |
| ESM | 12,840 B · 12.5 KB · 0.01 MB | 70 | 1 | 0 |

## Benefit

- **Saved:** 99.7% · 4,236,169 B · 4136.9 KB · 4.04 MB
- **Unused markers delta (singleton − esm):** 1900

## Commands

```bash
bun run lab:bench:smoke
bun run lab:bench -- --n=100
bun run lab:bench:wide -- --n=100
bun run lab:bench:cycles -- --n=100
```
