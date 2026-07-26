import { Hono } from "hono";
import type { ApiEnv } from "./lib/env";
import { verifyPassword, hashPassword } from "./lib/password";
import { hashToken } from "./lib/crypto";
import { writeAudit } from "./lib/audit";
import {
  MAX_FAILED_LOGINS,
  LOCKOUT_SECONDS,
  adminUserView,
  findUserByEmail,
  findUserById,
  isLocked,
  publicUserView,
  userAuditView,
  type UserRow,
} from "./lib/users";
import {
  introspectAccessToken,
  issueTokens,
  redeemRefreshToken,
  requireBearer,
  revokeAllSessions,
  revokeByTokenHash,
  revokeSession,
} from "./lib/sessions";
import { requireAdmin, requireSameAccount } from "./lib/authz";
import { normalizeEmail, nowIso, nowUnix } from "./lib/time";

const app = new Hono<{ Bindings: ApiEnv }>();

function form(body: Record<string, string | File>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function clientMeta(c: { req: { header: (n: string) => string | undefined } }) {
  return {
    ip: c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? null,
    userAgent: c.req.header("user-agent") ?? null,
  };
}

async function bumpUser(
  env: ApiEnv,
  id: string,
  expectedRvn: number,
  sets: string,
  binds: unknown[],
): Promise<boolean> {
  const result = await env.DB.prepare(
    `UPDATE users SET ${sets}, updated_at = ?, rvn = rvn + 1
     WHERE id = ? AND rvn = ? AND deleted_at IS NULL`,
  )
    .bind(...binds, nowIso(), id, expectedRvn)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

// --- OAuth (public) ---

app.post("/public/api/oauth/token", async (c) => {
  const body = form(await c.req.parseBody());
  const grantType = body.grant_type;
  const meta = clientMeta(c);

  if (grantType === "password") {
    const email = body.username;
    const password = body.password;
    if (!email || !password) {
      return c.json({ error: "invalid_request" }, 400);
    }

    const user = await findUserByEmail(c.env, email);
    if (!user || user.status !== "active") {
      return c.json({ error: "invalid_grant" }, 401);
    }
    if (isLocked(user)) {
      return c.json({ error: "account_locked" }, 423);
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      const fails = (user.failed_login_count ?? 0) + 1;
      const lockedUntil =
        fails >= MAX_FAILED_LOGINS ? nowUnix() + LOCKOUT_SECONDS : null;
      await c.env.DB.prepare(
        `UPDATE users
         SET failed_login_count = ?, locked_until = ?, updated_at = ?, rvn = rvn + 1
         WHERE id = ?`,
      )
        .bind(fails, lockedUntil, nowIso(), user.id)
        .run();
      await writeAudit(c.env, {
        actorId: user.id,
        action: "auth.login_failed",
        entityType: "user",
        entityId: user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return c.json({ error: "invalid_grant" }, 401);
    }

    await c.env.DB.prepare(
      `UPDATE users
       SET failed_login_count = 0, locked_until = NULL, last_login_at = ?,
           updated_at = ?, rvn = rvn + 1
       WHERE id = ?`,
    )
      .bind(nowIso(), nowIso(), user.id)
      .run();

    const tokens = await issueTokens(c.env, user, meta);
    if (!tokens) return c.json({ error: "server_error" }, 500);
    await writeAudit(c.env, {
      actorId: user.id,
      action: "auth.login_succeeded",
      entityType: "user",
      entityId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return c.json(tokens);
  }

  if (grantType === "refresh_token") {
    const refresh = body.refresh_token;
    if (!refresh) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const redeemed = await redeemRefreshToken(c.env, refresh, meta);
    if (!redeemed) {
      return c.json({ error: "invalid_grant" }, 401);
    }
    await writeAudit(c.env, {
      actorId: redeemed.accountId,
      action: redeemed.replayed ? "auth.refresh_replay" : "auth.refresh",
      entityType: "session",
      entityId: redeemed.sessionId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return c.json(redeemed.tokens);
  }

  return c.json({ error: "unsupported_grant_type" }, 400);
});

app.post("/public/api/oauth/introspect", async (c) => {
  const body = form(await c.req.parseBody());
  if (!body.token) {
    return c.json({ active: false });
  }
  return c.json(await introspectAccessToken(c.env, body.token));
});

app.post("/public/api/oauth/revoke", async (c) => {
  const body = form(await c.req.parseBody());
  const meta = clientMeta(c);
  if (body.token) {
    await revokeByTokenHash(c.env, await hashToken(body.token));
    await writeAudit(c.env, {
      action: "auth.revoke",
      entityType: "token",
      entityId: "redacted",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }
  return c.body(null, 200);
});

app.get("/public/api/.well-known/openid-configuration", (c) => {
  const base = new URL(c.req.url).origin + "/public/api";
  return c.json({
    issuer: c.env.OIDC_ISSUER,
    token_endpoint: `${base}/oauth/token`,
    introspection_endpoint: `${base}/oauth/introspect`,
    revocation_endpoint: `${base}/oauth/revoke`,
    jwks_uri: `${base}/.well-known/jwks.json`,
    response_types_supported: ["token"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["HS256"],
  });
});

app.get("/public/api/.well-known/jwks.json", (c) => c.json({ keys: [] }));

// --- Account public ---

app.get("/public/api/v1/users/:id", async (c) => {
  const auth = await requireBearer(c.env, c.req.header("Authorization"));
  if (auth instanceof Response) return auth;

  const id = c.req.param("id");
  const denied = requireSameAccount(auth.accountId, id);
  if (denied) return denied;

  const user = await findUserById(c.env, id);
  if (!user) return c.json({ error: "not_found" }, 404);
  return c.json(publicUserView(user));
});

app.patch("/public/api/v1/users/:id", async (c) => {
  const auth = await requireBearer(c.env, c.req.header("Authorization"));
  if (auth instanceof Response) return auth;

  const id = c.req.param("id");
  const denied = requireSameAccount(auth.accountId, id);
  if (denied) return denied;

  const body = await c.req.json<{
    email?: string;
    displayName?: string;
    rvn?: number;
  }>();
  const user = await findUserById(c.env, id);
  if (!user) return c.json({ error: "not_found" }, 404);

  const expectedRvn = body.rvn ?? user.rvn;
  const before = userAuditView(user);
  const email = body.email ? normalizeEmail(body.email) : user.email;
  const displayName = body.displayName ?? user.display_name;

  const ok = await bumpUser(
    c.env,
    id,
    expectedRvn,
    "email = ?, display_name = ?",
    [email, displayName],
  );
  if (!ok) return c.json({ error: "rvn_conflict" }, 409);

  const updated = (await findUserById(c.env, id))!;
  await writeAudit(c.env, {
    actorId: auth.accountId,
    action: "user.update",
    entityType: "user",
    entityId: id,
    before,
    after: userAuditView(updated),
    ...clientMeta(c),
  });
  return c.json(publicUserView(updated));
});

app.post("/public/api/v1/users/:id/password", async (c) => {
  const auth = await requireBearer(c.env, c.req.header("Authorization"));
  if (auth instanceof Response) return auth;

  const id = c.req.param("id");
  const denied = requireSameAccount(auth.accountId, id);
  if (denied) return denied;

  const body = await c.req.json<{
    currentPassword?: string;
    newPassword?: string;
    rvn?: number;
  }>();
  if (!body.currentPassword || !body.newPassword) {
    return c.json({ error: "invalid_request" }, 400);
  }
  if (body.newPassword.length < 10) {
    return c.json({ error: "weak_password" }, 400);
  }

  const user = await findUserById(c.env, id);
  if (!user) return c.json({ error: "not_found" }, 404);
  if (!(await verifyPassword(body.currentPassword, user.password_hash))) {
    return c.json({ error: "invalid_credentials" }, 401);
  }

  const expectedRvn = body.rvn ?? user.rvn;
  const ok = await bumpUser(
    c.env,
    id,
    expectedRvn,
    "password_hash = ?, password_changed_at = ?",
    [await hashPassword(body.newPassword), nowIso()],
  );
  if (!ok) return c.json({ error: "rvn_conflict" }, 409);

  await revokeAllSessions(c.env, id);
  await writeAudit(c.env, {
    actorId: auth.accountId,
    action: "user.password_changed",
    entityType: "user",
    entityId: id,
    ...clientMeta(c),
  });
  return c.json({ ok: true });
});

app.post("/public/api/v1/users/:id/email-verifications", async (c) => {
  const auth = await requireBearer(c.env, c.req.header("Authorization"));
  if (auth instanceof Response) return auth;
  const id = c.req.param("id");
  const denied = requireSameAccount(auth.accountId, id);
  if (denied) return denied;
  const user = await findUserById(c.env, id);
  if (!user) return c.json({ error: "not_found" }, 404);

  await writeAudit(c.env, {
    actorId: auth.accountId,
    action: "user.email_verification_requested",
    entityType: "user",
    entityId: user.id,
    ...clientMeta(c),
  });
  return c.json({ ok: true });
});

// --- Account admin ---

app.get("/admin/api/v1/admin/users", async (c) => {
  const auth = await requireAdmin(c.env, c.req.header("Authorization"));
  if (auth instanceof Response) return auth;

  const includeDeleted = c.req.query("includeDeleted") === "1";
  const sql = includeDeleted
    ? "SELECT * FROM users ORDER BY created_at ASC"
    : "SELECT * FROM users WHERE deleted_at IS NULL ORDER BY created_at ASC";
  const { results } = await c.env.DB.prepare(sql).all();
  return c.json((results ?? []).map((row) => adminUserView(row as UserRow)));
});

app.post("/admin/api/v1/admin/users", async (c) => {
  const auth = await requireAdmin(c.env, c.req.header("Authorization"));
  if (auth instanceof Response) return auth;

  const body = await c.req.json<{
    email?: string;
    displayName?: string;
    dateOfBirth?: string;
  }>();
  if (!body.email || !body.displayName || !body.dateOfBirth) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const id = crypto.randomUUID();
  const temp = crypto.randomUUID();
  const ts = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO users
      (id, email, display_name, date_of_birth, status, password_hash,
       created_at, updated_at, deleted_at, rvn, email_verified_at,
       password_changed_at, last_login_at, failed_login_count, locked_until)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?, NULL, 1, NULL, ?, NULL, 0, NULL)`,
  )
    .bind(
      id,
      normalizeEmail(body.email),
      body.displayName,
      body.dateOfBirth,
      await hashPassword(temp),
      ts,
      ts,
      ts,
    )
    .run();

  await c.env.DB.prepare(
    `INSERT INTO user_roles (user_id, role_id, created_at) VALUES (?, 'role_user', ?)`,
  )
    .bind(id, ts)
    .run();

  const user = (await findUserById(c.env, id))!;
  await writeAudit(c.env, {
    actorId: auth.accountId,
    action: "user.created",
    entityType: "user",
    entityId: id,
    after: userAuditView(user),
    ...clientMeta(c),
  });
  return c.json(adminUserView(user), 201);
});

app.get("/admin/api/v1/admin/users/:id", async (c) => {
  const auth = await requireAdmin(c.env, c.req.header("Authorization"));
  if (auth instanceof Response) return auth;
  const user = await findUserById(c.env, c.req.param("id"), {
    includeDeleted: true,
  });
  if (!user) return c.json({ error: "not_found" }, 404);
  return c.json(adminUserView(user));
});

app.patch("/admin/api/v1/admin/users/:id", async (c) => {
  const auth = await requireAdmin(c.env, c.req.header("Authorization"));
  if (auth instanceof Response) return auth;

  const id = c.req.param("id");
  const user = await findUserById(c.env, id);
  if (!user) return c.json({ error: "not_found" }, 404);

  const body = await c.req.json<{
    email?: string;
    displayName?: string;
    dateOfBirth?: string;
    status?: "active" | "suspended";
    rvn?: number;
  }>();

  const expectedRvn = body.rvn ?? user.rvn;
  const before = userAuditView(user);
  const ok = await bumpUser(
    c.env,
    id,
    expectedRvn,
    "email = ?, display_name = ?, date_of_birth = ?, status = ?",
    [
      body.email ? normalizeEmail(body.email) : user.email,
      body.displayName ?? user.display_name,
      body.dateOfBirth ?? user.date_of_birth,
      body.status ?? user.status,
    ],
  );
  if (!ok) return c.json({ error: "rvn_conflict" }, 409);

  if (body.status === "suspended") {
    await revokeAllSessions(c.env, id);
  }

  const updated = (await findUserById(c.env, id))!;
  await writeAudit(c.env, {
    actorId: auth.accountId,
    action: "user.admin_update",
    entityType: "user",
    entityId: id,
    before,
    after: userAuditView(updated),
    ...clientMeta(c),
  });
  return c.json(adminUserView(updated));
});

app.delete("/admin/api/v1/admin/users/:id", async (c) => {
  const auth = await requireAdmin(c.env, c.req.header("Authorization"));
  if (auth instanceof Response) return auth;

  const id = c.req.param("id");
  const user = await findUserById(c.env, id);
  if (!user) return c.json({ error: "not_found" }, 404);

  const body = (await c.req.json().catch(() => ({}))) as { rvn?: number };
  const expectedRvn = body.rvn ?? user.rvn;
  const before = userAuditView(user);
  const ok = await bumpUser(c.env, id, expectedRvn, "deleted_at = ?", [
    nowIso(),
  ]);
  if (!ok) return c.json({ error: "rvn_conflict" }, 409);

  await revokeAllSessions(c.env, id);
  const updated = (await findUserById(c.env, id, { includeDeleted: true }))!;
  await writeAudit(c.env, {
    actorId: auth.accountId,
    action: "user.soft_deleted",
    entityType: "user",
    entityId: id,
    before,
    after: userAuditView(updated),
    ...clientMeta(c),
  });
  return c.body(null, 204);
});

app.post("/admin/api/v1/admin/users/:id/password-resets", async (c) => {
  const auth = await requireAdmin(c.env, c.req.header("Authorization"));
  if (auth instanceof Response) return auth;

  const id = c.req.param("id");
  const user = await findUserById(c.env, id);
  if (!user) return c.json({ error: "not_found" }, 404);

  const temp = crypto.randomUUID();
  const ok = await bumpUser(
    c.env,
    id,
    user.rvn,
    "password_hash = ?, password_changed_at = ?, failed_login_count = 0, locked_until = NULL",
    [await hashPassword(temp), nowIso()],
  );
  if (!ok) return c.json({ error: "rvn_conflict" }, 409);

  await revokeAllSessions(c.env, id);
  await writeAudit(c.env, {
    actorId: auth.accountId,
    action: "user.password_reset",
    entityType: "user",
    entityId: id,
    ...clientMeta(c),
  });
  return c.json({ ok: true });
});

app.get("/admin/api/v1/admin/users/:id/audit-logs", async (c) => {
  const auth = await requireAdmin(c.env, c.req.header("Authorization"));
  if (auth instanceof Response) return auth;

  const { results } = await c.env.DB.prepare(
    `SELECT id, actor_id, action, entity_type, entity_id, before_json, after_json,
            ip, user_agent, created_at
     FROM audit_logs
     WHERE entity_type = 'user' AND entity_id = ?
     ORDER BY created_at DESC
     LIMIT 100`,
  )
    .bind(c.req.param("id"))
    .all();
  return c.json(results ?? []);
});

// --- Token admin ---

app.post("/admin/api/v1/accounts/:accountId/tokens", async (c) => {
  const auth = await requireAdmin(c.env, c.req.header("Authorization"));
  if (auth instanceof Response) return auth;
  const user = await findUserById(c.env, c.req.param("accountId"));
  if (!user) return c.json({ error: "not_found" }, 404);
  const tokens = await issueTokens(c.env, user, clientMeta(c));
  if (!tokens) return c.json({ error: "server_error" }, 500);
  await writeAudit(c.env, {
    actorId: auth.accountId,
    action: "auth.admin_issue_tokens",
    entityType: "user",
    entityId: user.id,
    ...clientMeta(c),
  });
  return c.json(tokens);
});

app.get("/admin/api/v1/accounts/:accountId/sessions", async (c) => {
  const auth = await requireAdmin(c.env, c.req.header("Authorization"));
  if (auth instanceof Response) return auth;

  const { results } = await c.env.DB.prepare(
    `SELECT id, account_id, family_id, expires_at, revoked, revoked_at,
            created_at, replaced_by_session_id, ip, user_agent
     FROM sessions WHERE account_id = ? ORDER BY created_at DESC`,
  )
    .bind(c.req.param("accountId"))
    .all();
  return c.json(results ?? []);
});

app.delete("/admin/api/v1/sessions/:sessionId", async (c) => {
  const auth = await requireAdmin(c.env, c.req.header("Authorization"));
  if (auth instanceof Response) return auth;
  await revokeSession(c.env, c.req.param("sessionId"));
  await writeAudit(c.env, {
    actorId: auth.accountId,
    action: "session.revoked",
    entityType: "session",
    entityId: c.req.param("sessionId"),
    ...clientMeta(c),
  });
  return c.body(null, 204);
});

app.delete("/admin/api/v1/accounts/:accountId/sessions", async (c) => {
  const auth = await requireAdmin(c.env, c.req.header("Authorization"));
  if (auth instanceof Response) return auth;
  await revokeAllSessions(c.env, c.req.param("accountId"));
  await writeAudit(c.env, {
    actorId: auth.accountId,
    action: "session.revoke_all",
    entityType: "user",
    entityId: c.req.param("accountId"),
    ...clientMeta(c),
  });
  return c.body(null, 204);
});

app.get("/admin/api/v1/tokens/:token", async (c) => {
  const auth = await requireAdmin(c.env, c.req.header("Authorization"));
  if (auth instanceof Response) return auth;
  return c.json(await introspectAccessToken(c.env, c.req.param("token")));
});

app.get("/", (c) =>
  c.json({
    service: "identity-service",
    auth: "/public/api/oauth/token",
    account: "/public/api/v1/users/:id",
  }),
);

export default app;
