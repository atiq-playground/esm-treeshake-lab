# Scale bench realistic

- **When:** Not verified yet
- **Case:** realistic
- **Status:** Placeholder until the `lab-realistic-bench` GitHub Actions workflow publishes a proof PR.

> Compare fair pairs only (singleton vs ESM within the same cache mode). Never average warm and cold into one score. Artifact byte/upload timings are a CI proxy — not a Cloudflare Workers deploy.

Run:

```bash
# Local (writes tmp/ for tiny N; docs/lab for N>3)
bun run lab:bench:realistic
bun run lab:bench:request

# Proof on GitHub Actions (workflow_dispatch)
# Actions → Lab realistic bench → Run workflow
```
