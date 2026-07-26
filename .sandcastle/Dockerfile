# Sandbox image for AFK Sandcastle runs against this App (see .sandcastle/orchestrate.ts
# and create-atiq-app issue #10). Extends the sandcastle default (Node + git + gh +
# Claude Code CLI + non-root `agent` user) with Bun (this App's runtime — see
# package.json `packageManager`) and the Playwright OS dependencies needed for the
# e2e smoke test (create-atiq-app issue #9).
FROM node:22-bookworm-slim

ARG AGENT_UID=1000
ARG AGENT_GID=1000

RUN apt-get update && apt-get install -y --no-install-recommends \
      git \
      curl \
      jq \
      ca-certificates \
      unzip \
    && rm -rf /var/lib/apt/lists/*

# GitHub CLI — required for the prompt's `gh issue view`/`gh pr` dynamic context.
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# Bun — this template installs/runs/tests with Bun, not npm (see package.json).
ENV BUN_INSTALL=/usr/local/bun
RUN curl -fsSL https://bun.sh/install | bash \
    && ln -s "$BUN_INSTALL/bin/bun" /usr/local/bin/bun
ENV PATH="$BUN_INSTALL/bin:${PATH}"

# Claude Code CLI — the agent Sandcastle drives via claudeCode() in orchestrate.ts.
RUN npm install -g @anthropic-ai/claude-code

# Playwright's OS-level dependencies (fonts, codecs, headless browser libs) for the
# e2e smoke test. Installed via npx so the apt package list stays in sync with
# whatever `playwright` version this App's package.json pins, without hand-listing
# packages here. Safe to run even before the e2e suite lands (installs libs only,
# no test execution).
RUN npx -y playwright install-deps chromium

RUN groupadd -g "${AGENT_GID}" agent \
    && useradd -m -u "${AGENT_UID}" -g "${AGENT_GID}" -s /bin/bash agent

USER agent
WORKDIR /home/agent/repo
