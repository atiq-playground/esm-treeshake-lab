# Scale bench wide

- **When:** 2026-07-26T14:29:35.117Z
- **Case:** wide
- **N:** 100
- **Fns/svc:** 40
- **Cycles:** false
- **Host:** esbuild
- **Mode:** generated

## Results

| Arm | Size | Build (ms) | Used markers | Unused retained |
|-----|------|----------:|-------------:|----------------:|
| Singleton | 8,663,206 B · 8460.2 KB · 8.26 MB | 74 | 100 | 3900 |
| ESM | 200 B | 4 | 1 | 0 |

## Benefit

- **Saved:** 100% · 8,663,006 B · 8460 KB · 8.26 MB
- **Unused markers delta (singleton − esm):** 3900

## Commands

```bash
bun run lab:bench:smoke
bun run lab:bench -- --n=100
bun run lab:bench:wide -- --n=100
bun run lab:bench:cycles -- --n=100
```
