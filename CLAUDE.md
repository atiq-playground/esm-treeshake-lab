# CLAUDE.md

**Canonical guidance lives in [AGENTS.md](AGENTS.md): read it first.** This
file is a deliberately thin pointer to avoid drift. Do not duplicate the soul
here; add only Claude-specific notes below. The hard rules are in
[RULES.md](RULES.md).

## Claude-Specific Notes

The `.claude/` tree mirrors `.cursor/`; only the provider-specific details
differ:

- **Agents:** [`.claude/agents/<name>.md`](.claude/agents), identical to the
  Cursor definitions.
- **Skills:** [`.claude/skills/<name>/SKILL.md`](.claude/skills), identical to
  the Cursor skills.
- **Rules:** [`.claude/rules/**/*.md`](.claude/rules), plain Markdown with no
  frontmatter. The equivalent Cursor rules are `.cursor/rules/**/*.mdc` and
  carry frontmatter (`globs`, `alwaysApply`) on the layered rules.

## Mirror Parity

Any agent, skill, or rule change here must be mirrored in `.cursor/`, and vice
versa, respecting each provider's format.
