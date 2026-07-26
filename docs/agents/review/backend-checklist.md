# Backend Review Checklist

Read this file together with `docs/agents/review/shared-standards.md` when reviewing backend-owned changes.

### Node.js/Backend Patterns (HIGH)

When reviewing backend code:

- **Unvalidated input**: Request body/params used without schema validation
- **Missing rate limiting**: Public endpoints without throttling
- **Unbounded queries**: `SELECT *` or queries without LIMIT on user-facing endpoints
- **N+1 queries**: Fetching related data in a loop instead of a join/batch
- **Missing timeouts**: External HTTP calls without timeout configuration
- **Error message leakage**: Sending internal error details to clients
- **Missing CORS configuration**: APIs accessible from unintended origins

```typescript
// BAD: N+1 query pattern
const users = await db.query("SELECT * FROM users");
for (const user of users) {
  user.posts = await db.query("SELECT * FROM posts WHERE user_id = $1", [
    user.id,
  ]);
}

// GOOD: Single query with JOIN or batch
const usersWithPosts = await db.query(`
  SELECT u.*, json_agg(p.*) as posts
  FROM users u
  LEFT JOIN posts p ON p.user_id = u.id
  GROUP BY u.id
`);
```