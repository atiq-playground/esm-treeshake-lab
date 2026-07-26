# AGENTS.md

Canonical guidance for any AI agent working in **test-app**. Read this
first. `CLAUDE.md` is a thin pointer back here; the hard, non-negotiable rules
live in [RULES.md](RULES.md).

## Project Overview

test-app is a next application scaffolded with the ai-harness
agent configuration: the same agents, skills, and layered rules mirrored under
[`.cursor/`](.cursor) and [`.claude/`](.claude), so Cursor and Claude Code
behave identically here.

## Core Principles

- **Agent-first.** Route non-trivial work through the right agent (plan,
  design, test, review) instead of improvising.
- **Plan before execute.** Non-trivial work starts with a plan — see the
  `planner` agent (and `architect` for design decisions).
- **TDD.** Write the failing test first, then the code — see the `tdd-guide`
  agent and `tdd` skill (red-green-refactor).
- **Security-first.** Treat external and untrusted input as untrusted until
  validated — see the `security-reviewer` agent.
- **Request-scoped auth.** Emulate Better Auth's per-request session model
  (cookies/headers → explicit bearer on outbound calls). Never ambient
  module-level tokens; token-handling code is server-only — see
  [`.cursor/rules/common/auth.mdc`](.cursor/rules/common/auth.mdc).
- **Immutability (CRITICAL).** Always create new objects; never mutate
  existing ones.
- **KISNS / DRY / YAGNI.** Keep it simple, not stupid; extract real
  repetition; do not build for imagined futures.
- **Confidence-based review.** Only report findings you are >80% sure are
  real; a clean review with zero findings is valid.

## Agents and Skills

Available agents live under [`.cursor/agents/`](.cursor/agents) (mirrored in
[`.claude/agents/`](.claude/agents)); available skills live under
[`.cursor/skills/<name>/SKILL.md`](.cursor/skills) (mirrored in
[`.claude/skills/`](.claude/skills)). Read a skill's `SKILL.md` before
invoking it.

## Rules

Layered rules live under [`.cursor/rules/**/*.mdc`](.cursor/rules) (mirrored
as plain Markdown under [`.claude/rules/**/*.md`](.claude/rules)): a
`common` baseline extended by language- and platform-specific rules.

## Review

Review agents read [`docs/agents/review/shared-standards.md`](docs/agents/review/shared-standards.md)
first, then the relevant domain checklist:
[`architecture-smells.md`](docs/agents/review/architecture-smells.md),
[`backend-checklist.md`](docs/agents/review/backend-checklist.md),
[`frontend-checklist.md`](docs/agents/review/frontend-checklist.md), or
[`security-checklist.md`](docs/agents/review/security-checklist.md).

## AFK Loop

**issue → agent → PR → review → e2e → merge → preview.** Label a tracked
issue and an agent builds it hands-off: it claims the issue, implements on
its own branch, and opens a draft PR. Automated review (`code-reviewer` then
`security-reviewer`) and required e2e checks run against the PR; a human
merges to `main` once green, which deploys a preview. Run
[`setup-skills`](.cursor/skills/setup-skills/SKILL.md) once to wire up the
issue tracker, triage labels, and domain docs this loop depends on.

## Framework Conventions

Framework-specific structure and conventions for next live in
`.cursor/rules/next/patterns.mdc` (mirrored under
`.claude/rules/next/patterns.md`). That rule is owned by the
Template that scaffolded this app, not by ai-harness — this file never
duplicates it.
