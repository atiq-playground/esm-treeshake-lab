import type { ApiEnv } from "./env";
import { nowIso, normalizeEmail } from "./time";

export type UserRow = {
  id: string;
  email: string;
  display_name: string;
  date_of_birth: string;
  status: "active" | "suspended";
  password_hash: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  rvn: number;
  email_verified_at: string | null;
  password_changed_at: string | null;
  last_login_at: string | null;
  failed_login_count: number;
  locked_until: number | null;
};

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_SECONDS = 15 * 60;

export function publicUserView(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
  };
}

export function adminUserView(row: UserRow) {
  return {
    ...publicUserView(row),
    dateOfBirth: row.date_of_birth,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    rvn: row.rvn,
    emailVerifiedAt: row.email_verified_at,
    passwordChangedAt: row.password_changed_at,
    lastLoginAt: row.last_login_at,
    failedLoginCount: row.failed_login_count,
    lockedUntil: row.locked_until,
  };
}

/** Safe snapshot for audit_logs (never password_hash). */
export function userAuditView(row: UserRow) {
  const { password_hash: _, ...rest } = row;
  return rest;
}

export async function findUserByEmail(
  env: ApiEnv,
  email: string,
): Promise<UserRow | null> {
  return (
    (await env.DB.prepare(
      `SELECT * FROM users
       WHERE email = ? AND deleted_at IS NULL`,
    )
      .bind(normalizeEmail(email))
      .first<UserRow>()) ?? null
  );
}

export async function findUserById(
  env: ApiEnv,
  id: string,
  opts?: { includeDeleted?: boolean },
): Promise<UserRow | null> {
  if (opts?.includeDeleted) {
    return (
      (await env.DB.prepare("SELECT * FROM users WHERE id = ?")
        .bind(id)
        .first<UserRow>()) ?? null
    );
  }
  return (
    (await env.DB.prepare(
      `SELECT * FROM users WHERE id = ? AND deleted_at IS NULL`,
    )
      .bind(id)
      .first<UserRow>()) ?? null
  );
}

export function isLocked(user: UserRow, now = Math.floor(Date.now() / 1000)) {
  return typeof user.locked_until === "number" && user.locked_until > now;
}
