# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues on
[`atiq-playground/esm-treeshake-lab`](https://github.com/atiq-playground/esm-treeshake-lab).
Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`.
- **List issues**: `gh issue list --state open --json number,title,body,labels`.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`: `gh` does this automatically when run inside a clone. If the remote is missing, pass `-R atiq-playground/esm-treeshake-lab`.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## When a skill says "publish to the issue tracker"

Create a GitHub issue on `atiq-playground/esm-treeshake-lab`.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Windwaker operations

Used by `/windwaker`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `windwaker:map`, holding the Notes / Decisions-so-far / Fog body. Current map: [#15 Singleton vs ESM scale bench](https://github.com/atiq-playground/esm-treeshake-lab/issues/15). Prior map: [#1 ESM tree-shake lab monorepo](https://github.com/atiq-playground/esm-treeshake-lab/issues/1).
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `windwaker:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies**: add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body.
- **Frontier query**: list the map's open children, drop any with an open blocker or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`: the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
