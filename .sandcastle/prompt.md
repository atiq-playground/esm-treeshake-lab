# AFK task

You are running unattended (AFK) inside a sandboxed git worktree on branch
`{{SOURCE_BRANCH}}`. Your work will be diffed against `{{TARGET_BRANCH}}`.

This App was scaffolded by `create-atiq-app` and carries the `ai-harness`
agent config under `.cursor/` and `.claude/`. Every agent, skill, and rule
you need already exists there — invoke them **by name only**. Do not
redefine, reinterpret, summarize into your own words, or work around any
harness agent, skill, or rule; if one seems to be missing or wrong, say so
in your final summary instead of inventing a replacement.

## Issue

!`gh issue view {{ISSUE_NUMBER}} --json title,body,labels,comments`

## Instructions

1. Follow the harness `/implement` skill for this issue end to end: claim
   it, work on the current branch (already checked out for you as
   `{{SOURCE_BRANCH}}` — do not create another branch or switch away from
   it), and build test-first per the harness `tdd` skill/`tdd-guide` agent.
2. Before finishing, run the harness `code-reviewer` agent (which delegates
   security-sensitive scope to `security-reviewer`) against your changes and
   address any finding you are confident is real.
3. Commit your work using the project's commit convention as you go. Do not
   push or open a pull request yourself — the calling workflow pushes
   `{{SOURCE_BRANCH}}` and opens the draft PR once this run completes.
4. If you get genuinely stuck (missing credentials, an ambiguous
   requirement only a human can resolve, etc.), commit whatever safe partial
   progress you have, explain the blocker plainly, and still emit the
   completion signal below — do not loop forever.

When you are done, emit this exact line on its own so the orchestrator can
stop early:

<promise>COMPLETE</promise>
