---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

## 1. Identify and claim the ticket

Work from whatever the user gave you: a spec, tickets, or an issue reference. If none is in context, ask which issue this is.

If there genuinely isn't one, ask whether to create one first. If yes, create it, then claim it. If no, skip claiming and proceed with implementation anyway.

Once an issue is identified, claim it the same way /windwaker claims tickets: assign yourself, first, before any code changes, so a concurrent session sees it's taken and skips it.

## 2. Get on a branch (and isolate if needed)

Check whether a branch already exists for this issue. If one does, ask before reusing it. If not, create one named `agent/<type>/issue-<n>-<slug>` (e.g. `agent/feat/issue-1-harness-install-cli`), using the same `type` vocabulary as commit messages (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`).

Never commit directly to a shared/default branch.

**Isolation.** Default to a plain branch in the main checkout: **do not** create a worktree when the solution can be built without one.

Prefer worktree-per-run owned one layer up when available:

- Headless AFK: `.sandcastle/`
- Interactive parallel attempts on one ticket: Cursor `best-of-n-runner` / cloud subagents

Create a git worktree only when it's **necessary**: another session is already using this checkout on a different ticket, you've hit a checkout collision, or Sandcastle / cloud agents aren't set up (or fail) and the same conflict would otherwise happen. Then do all subsequent work inside the worktree:

```bash
git worktree add <repo-parent>/<repo>-worktrees/issue-<n> <branch>
```

Example: `/home/atiq/projects/ai/create-atiq-app-worktrees/issue-9` for issue `#9` of `create-atiq-app`. Reuse an existing worktree for this issue if one is already registered; do not create a second path for the same issue. Worktrees don't share `node_modules`: install dependencies fresh inside the worktree before building. See [ADR 0007](../../../docs/adr/0007-agent-branch-and-draft-pr-workflow-for-implement.md).

## 3. Build test-first

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

## 4. Review

Once done, review the work against [RULES.md](../../../RULES.md) and the
applicable layered rules under `.cursor/rules/`. Fix CRITICAL/HIGH issues
in-session; only carry forward findings you consciously decide to defer.

## 5. Commit and open a PR

Commit your work to the branch with conventional commits.

Push, then open the PR yourself as a **draft**, with `Closes #<n>` in the
body: full commit history, diff against the base branch, a comprehensive
summary, and a test plan.

## 6. Clean up the worktree (mandatory if you created one)

If step 2 created a worktree for this issue, remove it after the draft PR is open: or as soon as the session ends without finishing. From the main repo:

```bash
git worktree remove <repo-parent>/<repo>-worktrees/issue-<n>
```

Do not leave orphan worktrees for finished or abandoned runs. If remove fails (dirty tree, lock, etc.), warn the user with the path and the exact error; never silently abandon the worktree. Removing the worktree does not delete the remote branch or the PR.
