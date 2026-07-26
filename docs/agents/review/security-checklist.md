# Security Review Checklist

Read this file together with `docs/agents/review/shared-standards.md` when the assigned changes contain a security-sensitive surface or when acting as the dedicated Security reviewer.

### Security (CRITICAL)

These MUST be flagged — they can cause real damage:

- **Hardcoded credentials** — API keys, passwords, tokens, connection strings in source
- **SQL injection** — String concatenation in queries instead of parameterized queries
- **XSS vulnerabilities** — Unescaped user input rendered in HTML/JSX
- **Path traversal** — User-controlled file paths without sanitization
- **CSRF vulnerabilities** — State-changing endpoints without CSRF protection
- **Authentication bypasses** — Missing auth checks on protected routes
- **Ambient / process-global user tokens** — Module `let`, `globalThis`, or
  singleton holding access/refresh/ID tokens; `setAccessToken`-style ambient
  APIs; shared `request()` that auto-attaches a process-wide Bearer. Tokens
  must be request-scoped (cookies/headers) and passed explicitly; token code
  must be server-only. See `.cursor/rules/common/auth.mdc`.
- **Insecure dependencies** — Known vulnerable packages
- **Exposed secrets in logs** — Logging sensitive data (tokens, passwords, PII)

```typescript
// BAD: SQL injection via string concatenation
const query = `SELECT * FROM users WHERE id = ${userId}`;

// GOOD: Parameterized query
const query = `SELECT * FROM users WHERE id = $1`;
const result = await db.query(query, [userId]);
```

```typescript
// BAD: Rendering raw user HTML without sanitization
// Always sanitize user content with DOMPurify.sanitize() or equivalent

// GOOD: Use text content or sanitize
<div>{userComment}</div>
```