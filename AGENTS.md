# AGENTS.md

Canonical guidance for any AI agent working in **test-app**. Read this
first. `CLAUDE.md` is a thin pointer back here; the hard, non-negotiable rules
live in [RULES.md](RULES.md).

## Project Overview

test-app is a next application scaffolded with the ai-harness
agent configuration: skills and layered rules mirrored under
[`.cursor/`](.cursor) and [`.claude/`](.claude), so Cursor and Claude Code
behave identically here.

## Core Principles

- **Plan before execute.** Non-trivial work starts with a plan (skills like
  `windwaker` / `grilling` when the path is unclear).
- **TDD.** Write the failing test first, then the code: see the `tdd` skill
  (red-green-refactor).
- **Security-first.** Treat external and untrusted input as untrusted until
  validated. Never ambient module-level tokens; token-handling code is
  server-only.
- **Immutability (CRITICAL).** Always create new objects; never mutate
  existing ones.
- **KISNS / DRY / YAGNI.** Keep it simple, not stupid; extract real
  repetition; do not build for imagined futures.
- **Confidence-based review.** Only report findings you are >80% sure are
  real; a clean review with zero findings is valid.

## Skills

Available skills live under [`.cursor/skills/<name>/SKILL.md`](.cursor/skills)
(mirrored in [`.claude/skills/`](.claude/skills)). Read a skill's `SKILL.md`
before invoking it.

## Rules

Layered rules live under [`.cursor/rules/**/*.mdc`](.cursor/rules) (mirrored
as plain Markdown under [`.claude/rules/**/*.md`](.claude/rules)):
`common/release` plus language- and platform-specific rules (`typescript`,
`react`, `web`, `next`).

## Issue tracker

Tracker ops for Windwaker and related workflows live in
[`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md). Run
[`setup-skills`](.cursor/skills/setup-skills/SKILL.md) once to wire the
tracker and domain docs.

## Releases

After every merge to `main`, run the full release pipeline (semver bump,
release branch, README, GitHub tag/release): see
[`.cursor/rules/common/release.mdc`](.cursor/rules/common/release.mdc)
(mirrored under `.claude/rules/common/release.md`).

## Framework Conventions

Framework-specific structure and conventions for next live in
`.cursor/rules/next/patterns.mdc` (mirrored under
`.claude/rules/next/patterns.md`). That rule is owned by the
Template that scaffolded this app, not by ai-harness: this file never
duplicates it.
