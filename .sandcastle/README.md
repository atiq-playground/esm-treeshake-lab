# `.sandcastle/`

Configuration for running this App's `ai-harness` agents unattended (AFK)
inside a [Sandcastle](https://github.com/mattpocock/sandcastle) sandbox.
Docker is the default sandbox runtime; `orchestrate.ts` keeps the provider
choice behind a single seam (`SANDCASTLE_SANDBOX` / `resolveSandboxProvider`)
so a cloud provider can be swapped in later without touching call sites.

| File | Purpose |
| --- | --- |
| `Dockerfile` | Sandbox image: Node + git + `gh` + Claude Code CLI + Bun + Playwright OS deps + non-root `agent` user |
| `.env.example` | Token placeholders — copy to `.env` (gitignored) and fill in for local runs |
| `prompt.md` | Agent instructions — references harness agents/skills (`/implement`, `code-reviewer`, …) by name only |
| `orchestrate.ts` | AFK runner — `bun run orchestrate <issue-number>` |
| `orchestrate.test.ts` | Unit tests for the pure `buildRunOptions`/`resolveSandboxProvider` seam |

## Manual test (Docker sandbox)

This is the acceptance check for create-atiq-app issue #10 — run it once
after any change to this directory or to `orchestrate.ts`:

1. Prerequisites: Docker Desktop (or a Docker-compatible daemon) running
   locally, and this template scaffolded as a standalone App (`bun install`
   run from the App root, not from inside the `create-atiq-app` monorepo).
2. `cp .sandcastle/.env.example .sandcastle/.env` and fill in
   `CLAUDE_CODE_OAUTH_TOKEN` (or `ANTHROPIC_API_KEY`) and `GH_TOKEN`.
3. Build the sandbox image once:
   `npx @ai-hero/sandcastle docker build-image --image-name sandcastle:next-app --dockerfile .sandcastle/Dockerfile`
4. Pick a real open issue on the App's repo and run:
   `SANDCASTLE_IMAGE_NAME=sandcastle:next-app bun run orchestrate <issue-number>`
5. Confirm: the run completes (or hits `maxIterations`) without a Sandcastle
   setup error, a new `agent/issue-<n>` branch exists locally with at least
   one commit, and `.sandcastle/logs/` contains the run's log file.
6. Inspect the diff on `agent/issue-<n>` before deciding whether to push it —
   this manual run does not push or open a PR (see create-atiq-app issue #11
   for the automated Action that does).

Steps 3–6 need a live Docker daemon and a Claude Code credential, so they are
a manual, human-run check rather than something CI or an AFK agent can
verify unattended.
