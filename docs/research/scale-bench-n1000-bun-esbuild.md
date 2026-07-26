# Research: N=1000 scale bench under Bun + esbuild

- **Ticket:** [Research whether 1000 package workspaces stay practical under Bun/Nx](https://github.com/atiq-playground/esm-treeshake-lab/issues/24)
- **Map:** [Singleton vs ESM scale bench](https://github.com/atiq-playground/esm-treeshake-lab/issues/15)
- **Date:** 2026-07-26

## Question

At N=1000 generated packages per arm, what are practical limits for Bun workspaces and the **esbuild-primary** harness (Next scale host dropped: [#28](https://github.com/atiq-playground/esm-treeshake-lab/issues/28))?

## Method

Ephemeral trees under `/tmp` (not this monorepo):

1. Generate N tiny packages (`index.js` + `package.json`), ~2KB unused ballast + load side effects.
2. Time package generation and `bun install` with `workspaces: ["packages/*"]`.
3. Bundle singleton entry (side-effect `import` of all N + `used()` on svc-0) vs ESM entry (import svc-0 only) with `bunx esbuild --bundle --format=esm`.

Hardware: local WSL2 / Bun 1.3.x (dev laptop class). Numbers are order-of-magnitude, not CI SLOs.

## Results

| N | Gen (s) | `bun install` (s) | Tree on disk | esbuild singleton (s) | esbuild ESM (s) | Bundle bytes S / E | Unused markers in S / E | Bytes saved |
|---|---------|-------------------|--------------|----------------------|-----------------|--------------------|-------------------------|-------------|
| 3 | ~0.00 | ~0.02 | ~48KB | ~0.05 | ~0.04 | 517 / 251 | 3 / 1 | ~52% |
| 100 | ~0.01 | ~0.01 | ~0.8MB | ~0.05 | ~0.05 | 13KB / 251 | 100 / 1 | ~98% |
| 1000 | ~0.06 | ~0.03 | ~8MB | ~0.08 | ~0.05 | 134KB / 251 | 1000 / 1 | ~99.8% |

Notes:

- **Bun install at N=1000 is fine** for empty/private workspace packages (tens of ms in this setup).
- **esbuild at N=1000 is fine** (~80ms singleton arm) when entries use relative or resolvable paths; wall time stays interactive on a laptop.
- **Disk** for 1000 stub packages is small (~8MB sources) before `node_modules` linking in a real repo.
- Side-effect imports are required for the singleton arm to retain modules; pure `import { used }` of one package matches the ESM arm (both shake). That matches the locked fixture graph (plugins index side-effect imports all N).

## Nx

Not stress-tested with a full `nx` graph of 2000 projects. Expect:

- **Risk:** registering every generated package as an Nx project with `build`/`typecheck` will dominate graph compute and CI `run-many`.
- **Mitigation (recommended for Notes):** generated packages are **workspace packages for resolution only**: no per-package Nx targets; only scripts (`lab:generate`, `lab:bench`) and `@apps/docs` are Nx projects. Smoke N=3 may be listed if useful; N=100/1000 generated trees stay gitignored and outside `nx run-many -t build`.

## Next.js

Out of scope for scale metrics after [#28](https://github.com/atiq-playground/esm-treeshake-lab/issues/28). Do not use Next wall time as a gate for N=1000.

## Guidance for the lab

| N | Guidance |
|---|----------|
| **3** | Always: CI smoke |
| **100** | Default local full bench: comfortable |
| **1000** | Supported for esbuild metrics on a laptop; expect larger singleton bundle + more marker noise, still sub-second esbuild in this probe. Avoid Nx `run-many` over all generated packages. |

## Answer

**N=1000 is practical** for Bun workspaces + esbuild scale bench on a laptop when generated packages are not full Nx project targets. Prefer N=100 as the documented default; treat N=1000 as an optional stress flag, not CI.
