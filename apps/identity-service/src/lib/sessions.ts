import type { ApiEnv } from "./env";
import { TOKEN_TTL_SECONDS } from "./env";
import { hashToken, randomOpaqueToken, sealJson, unsealJson } from "./crypto";
import { mintIdToken } from "./jwt";
import type { UserRow } from "./users";
import { findUserById } from "./users";
import { nowUnix } from "./time";

export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  id_token: string;
};

/** Concurrent tabs may present the same refresh during rotation. */
export const REFRESH_REUSE_GRACE_SECONDS = 10;

async function wipeFamily(
  env: ApiEnv,
  familyId: string,
  now = nowUnix(),
): Promise<void> {
  await env.DB.prepare(
    `UPDATE sessions
     SET revoked = 1,
         revoked_at = COALESCE(revoked_at, ?),
         rotation_response_json = NULL,
         rotation_replay_until = NULL
     WHERE family_id = ?`,
  )
    .bind(now, familyId)
    .run();
}

export async function issueTokens(
  env: ApiEnv,
  user: UserRow,
  opts?: {
    familyId?: string;
    replacedSessionId?: string;
    ip?: string | null;
    userAgent?: string | null;
  },
): Promise<TokenResponse | null> {
  const sessionId = crypto.randomUUID();
  const familyId = opts?.familyId ?? sessionId;
  const accessToken = randomOpaqueToken();
  const refreshToken = randomOpaqueToken();
  const now = nowUnix();
  const expiresAt = now + TOKEN_TTL_SECONDS;

  const [accessHash, refreshHash] = await Promise.all([
    hashToken(accessToken),
    hashToken(refreshToken),
  ]);

  await env.DB.prepare(
    `INSERT INTO sessions
      (id, account_id, access_token_hash, refresh_token_hash, expires_at, revoked,
       created_at, family_id, replaced_by_session_id, revoked_at, ip, user_agent,
       rotation_response_json, rotation_replay_until)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, NULL, NULL, ?, ?, NULL, NULL)`,
  )
    .bind(
      sessionId,
      user.id,
      accessHash,
      refreshHash,
      expiresAt,
      now,
      familyId,
      opts?.ip ?? null,
      opts?.userAgent ?? null,
    )
    .run();

  const tokens: TokenResponse = {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    id_token: await mintIdToken(env, user),
  };

  if (opts?.replacedSessionId) {
    const sealed = await sealJson(env.OIDC_SIGNING_SECRET, tokens);
    const replayUntil = now + REFRESH_REUSE_GRACE_SECONDS;
    const result = await env.DB.prepare(
      `UPDATE sessions
       SET revoked = 1,
           revoked_at = ?,
           replaced_by_session_id = ?,
           rotation_response_json = ?,
           rotation_replay_until = ?
       WHERE id = ? AND revoked = 0`,
    )
      .bind(now, sessionId, sealed, replayUntil, opts.replacedSessionId)
      .run();

    // Lost CAS race: another rotator already claimed this refresh.
    if ((result.meta.changes ?? 0) === 0) {
      await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`)
        .bind(sessionId)
        .run();
      return null;
    }
  }

  return tokens;
}

export type RedeemRefreshResult = {
  tokens: TokenResponse;
  accountId: string;
  sessionId: string;
  replayed: boolean;
};

async function replaySealedRotation(
  env: ApiEnv,
  tokenHash: string,
): Promise<RedeemRefreshResult | null> {
  const now = nowUnix();
  const row = await env.DB.prepare(
    `SELECT id, account_id, family_id, rotation_response_json, rotation_replay_until
     FROM sessions
     WHERE refresh_token_hash = ?
       AND revoked = 1
       AND replaced_by_session_id IS NOT NULL
       AND rotation_response_json IS NOT NULL
       AND rotation_replay_until IS NOT NULL`,
  )
    .bind(tokenHash)
    .first<{
      id: string;
      account_id: string;
      family_id: string;
      rotation_response_json: string;
      rotation_replay_until: number;
    }>();

  if (!row) return null;

  if (row.rotation_replay_until < now) {
    // Reuse after grace ⇒ treat as theft; kill the whole rotation family.
    await wipeFamily(env, row.family_id, now);
    return null;
  }

  const tokens = await unsealJson<TokenResponse>(
    env.OIDC_SIGNING_SECRET,
    row.rotation_response_json,
  );
  if (!tokens?.refresh_token || !tokens.access_token || !tokens.id_token) {
    return null;
  }

  return {
    tokens,
    accountId: row.account_id,
    sessionId: row.id,
    replayed: true,
  };
}

/**
 * Redeem a refresh token: CAS-rotate once, then idempotently replay the sealed
 * TokenResponse until rotation_replay_until (multi-tab safe; no multi-mint).
 */
export async function redeemRefreshToken(
  env: ApiEnv,
  refreshToken: string,
  meta?: { ip?: string | null; userAgent?: string | null },
): Promise<RedeemRefreshResult | null> {
  const tokenHash = await hashToken(refreshToken);

  const active = await env.DB.prepare(
    `SELECT id, account_id, family_id FROM sessions
     WHERE refresh_token_hash = ? AND revoked = 0 AND revoked_at IS NULL`,
  )
    .bind(tokenHash)
    .first<{
      id: string;
      account_id: string;
      family_id: string | null;
    }>();

  if (active) {
    const user = await findUserById(env, active.account_id);
    if (!user || user.status !== "active") return null;

    const tokens = await issueTokens(env, user, {
      familyId: active.family_id ?? active.id,
      replacedSessionId: active.id,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    if (tokens) {
      return {
        tokens,
        accountId: user.id,
        sessionId: active.id,
        replayed: false,
      };
    }

    // Lost rotate race — return the winner's sealed replay if still in grace.
    return replaySealedRotation(env, tokenHash);
  }

  return replaySealedRotation(env, tokenHash);
}

export async function revokeSession(
  env: ApiEnv,
  sessionId: string,
): Promise<void> {
  const row = await env.DB.prepare(
    `SELECT family_id FROM sessions WHERE id = ?`,
  )
    .bind(sessionId)
    .first<{ family_id: string }>();
  if (!row) return;
  await wipeFamily(env, row.family_id);
}

export async function revokeAllSessions(
  env: ApiEnv,
  accountId: string,
): Promise<void> {
  const now = nowUnix();
  // Include already-rotated predecessors so sealed grace blobs cannot outlive logout.
  await env.DB.prepare(
    `UPDATE sessions
     SET revoked = 1,
         revoked_at = COALESCE(revoked_at, ?),
         rotation_response_json = NULL,
         rotation_replay_until = NULL
     WHERE account_id = ?`,
  )
    .bind(now, accountId)
    .run();
}

export async function revokeByTokenHash(
  env: ApiEnv,
  tokenHash: string,
): Promise<void> {
  // Match active or already-rotated rows (stale refresh after CAS rotate).
  const row = await env.DB.prepare(
    `SELECT family_id FROM sessions
     WHERE access_token_hash = ? OR refresh_token_hash = ?
     ORDER BY created_at DESC
     LIMIT 1`,
  )
    .bind(tokenHash, tokenHash)
    .first<{ family_id: string }>();
  if (!row) return;
  await wipeFamily(env, row.family_id);
}

export async function introspectAccessToken(env: ApiEnv, token: string) {
  const row = await env.DB.prepare(
    `SELECT s.account_id, s.expires_at, u.status AS user_status, u.deleted_at
     FROM sessions s
     JOIN users u ON u.id = s.account_id
     WHERE s.access_token_hash = ? AND s.revoked = 0 AND s.revoked_at IS NULL`,
  )
    .bind(await hashToken(token))
    .first<{
      account_id: string;
      expires_at: number;
      user_status: string;
      deleted_at: string | null;
    }>();

  const now = nowUnix();
  if (
    !row ||
    row.expires_at < now ||
    row.user_status !== "active" ||
    row.deleted_at
  ) {
    return { active: false as const };
  }
  return {
    active: true as const,
    sub: row.account_id,
    exp: row.expires_at,
  };
}

export async function requireBearer(
  env: ApiEnv,
  authorization: string | undefined,
): Promise<{ accountId: string } | Response> {
  if (!authorization?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const token = authorization.slice("Bearer ".length).trim();
  const result = await introspectAccessToken(env, token);
  if (!result.active || !result.sub) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return { accountId: result.sub };
}
