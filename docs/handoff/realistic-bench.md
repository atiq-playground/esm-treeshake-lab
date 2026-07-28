# Handoff: Realistic GraphQL pipeline bench (GHA)

**Map:** [#35 Realistic GraphQL pipeline bench (GHA)](https://github.com/atiq-playground/esm-treeshake-lab/issues/35)  
**Status:** Design locked — implement from this checklist.  
**Base branch:** `main`  
**Domain:** [`CONTEXT.md`](../../CONTEXT.md) (Realistic case, Arm, pipeline report, request-time, GHA proof, Last verified)

## Goal

Ship a **realistic GraphQL-shaped** singleton vs ESM bench and prove it on demand in GitHub Actions: pipeline cost (cold + warm) + request-time HTTP load on Node, with committed `docs/lab/benchmark-realistic-latest.*` and **Last verified** on Research + README. Homepage stays UC1.

## Locked profile

| Knob | Value |
|------|--------|
| Case | `--case=realistic` (preset + flag overrides); script `lab:bench:realistic` |
| N | 100 |
| `--fns` | 20 (defined surface) |
| `--used` | 1000 (~10 call sites/pkg) |
| Cycles | on (**only** combined with 3p under `realistic`) |
| 3p | `--3p=real` |
| Call sites | even ~10/pkg, same both arms; **no `--seed`** |
| Report | `docs/lab/benchmark-realistic-latest.{json,md}` only |

## Out of scope (do not build)

- Cloudflare publish / separate Worker for the bench; docs OpenNext Worker as bench host
- Weekly schedule; full realistic on every PR (`ci.yml` stays smoke N=3)
- Hand-written GraphQL / Apollo / Yoga product
- Replacing UC1 homepage numbers
- npm publish
- Averaging warm + cold into one score

---

## Implementation checklist (ordered)

### 1. Harness: `--case=realistic`

- [ ] Extend `BenchCase` / `isBenchCase` / `reportArtifactBase` → `benchmark-realistic-latest`
- [ ] `generate-scale-bench.ts`: allow **cycles + `--3p=real` only** when case is `realistic`
- [ ] `run-scale-bench.ts`: preset defaults above; UC4-style multi call sites; reject `--seed` for realistic (or ignore with warning)
- [ ] Package script: `"lab:bench:realistic": "bun run scripts/lab/run-scale-bench.ts --case=realistic"`
- [ ] Tests: artifact base name; case parsing; cycles+3p rejected outside realistic
- [ ] Do **not** change UC1–UC4 / thirdparty / fleet semantics

Refs: [#36](https://github.com/atiq-playground/esm-treeshake-lab/issues/36)

### 2. Pipeline timings + report schema

- [ ] Keep `version: 1` `arms` / `benefit` (bytes, markers, `buildMs` once)
- [ ] Add `pipeline.warm` / `pipeline.cold` each with `singleton` / `esm`:
  - `generateMs`, `installMs`, `bundleMs`, `artifactBytes`, `artifactUploadMs` (null local), `pipelineTotalMs`
- [ ] Add `proof`: `timestamp`, `githubRunUrl`, `githubRunId`, `runner` (`github-actions` | `local`)
- [ ] Add `request` (filled in step 3; may be `null` until request harness wired)
- [ ] Methodology in MD: fair pairs only; never average warm/cold; artifact proxy ≠ CF deploy
- [ ] Local path sets `artifactUploadMs` / run URL null, `runner: "local"`

Refs: [#37](https://github.com/atiq-playground/esm-treeshake-lab/issues/37)

### 3. Request-time harness

- [ ] New `scripts/lab/run-request-bench.ts` + `"lab:bench:request"`
- [ ] Leave `lab:bench:coldstart` as import + RSS only
- [ ] Per arm: thin Node HTTP server importing that arm’s bundle
- [ ] `POST /invoke` = one full pass of all wired call sites (~1000)
- [ ] Defaults: warmup **50** (discard), measured **1000**, concurrency **1**
- [ ] Metrics: p50/p95 latency, `process.cpuUsage` delta, RSS/heap
- [ ] Write `request.singleton` / `request.esm` once (not × warm/cold)
- [ ] Required disclaimer: Node on GHA/local ≠ CF isolate / prod gateway RPS

Refs: [#38](https://github.com/atiq-playground/esm-treeshake-lab/issues/38)

### 4. GHA workflow + proof PR

- [ ] Add `.github/workflows/lab-realistic-bench.yml`
- [ ] Trigger: **`workflow_dispatch` only**
- [ ] One job, `timeout-minutes: 90`
- [ ] Steps (named): cold pipeline → warm pipeline (Bun cache) → request load → write report (`proof` from `GITHUB_*`) → open PR
- [ ] Branch: `chore/realistic-bench-<run_id>`; human merges — **no direct push to `main`**
- [ ] Artifacts: `realistic-bench-report`, `realistic-bench-bundles`
- [ ] Permissions: `contents: write`, `pull-requests: write` (`GITHUB_TOKEN`; PAT if protection blocks)
- [ ] Do **not** hook into `ci.yml` / `deploy.yml` for this bench

Refs: [#39](https://github.com/atiq-playground/esm-treeshake-lab/issues/39)

### 5. Last verified docs + README

- [ ] Research (`apps/docs/content/docs/research.mdx`): section **Realistic GraphQL pipeline (GHA)**
  - Last verified from `proof`; summary table (bytes saved %, warm/cold `pipelineTotalMs` per arm, request p95); link to md
  - Empty state: “Not verified yet — run `lab-realistic-bench` workflow”
- [ ] README: scale-bench table row + Last verified line; Map → [#35](https://github.com/atiq-playground/esm-treeshake-lab/issues/35)
- [ ] Homepage: **no** realistic numbers (UC1 only)
- [ ] Read committed JSON at build time — no live Actions API; no hard-coded dates

Refs: [#40](https://github.com/atiq-playground/esm-treeshake-lab/issues/40)

### 6. Verify before merge

- [ ] `bun run lab:bench:realistic` locally writes sibling report (`runner: local`)
- [ ] `bun run lab:bench:request` against those bundles fills `request`
- [ ] `bun run lab:bench:smoke` still green; UC1 `benchmark-latest.*` untouched
- [ ] Manual `workflow_dispatch` once → PR with verified `proof` → merge → Research/README show Last verified

---

## Suggested PR slices (execute time)

1. Harness `realistic` case + tests (no GHA yet)  
2. Pipeline schema + local timing  
3. Request harness  
4. Workflow + proof PR  
5. Research + README Last verified surface  

Use `/tdd` for bench scripts. Keep CONTEXT.md terms if language drifts.

## Done when

- Checklist items above are implemented and smoke still passes  
- At least one merged proof PR has populated Last verified from GHA  
- Map [#35](https://github.com/atiq-playground/esm-treeshake-lab/issues/35) can be closed as destination met (implementation complete) or left open until first verified run — prefer close design map after handoff; track execute on a ready-for-agent issue if desired
