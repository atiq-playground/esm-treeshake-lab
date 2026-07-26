import type { ApiEnv } from "./env";
import { requireBearer } from "./sessions";

function forbidden(): Response {
  return new Response(JSON.stringify({ error: "forbidden" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

/** IDOR guard: bearer subject must match the path resource id. */
export function requireSameAccount(
  authAccountId: string,
  resourceId: string,
): Response | null {
  if (authAccountId !== resourceId) {
    return forbidden();
  }
  return null;
}

export async function userHasRole(
  env: ApiEnv,
  accountId: string,
  roleId: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 AS ok FROM user_roles
     WHERE user_id = ? AND role_id = ?
     LIMIT 1`,
  )
    .bind(accountId, roleId)
    .first<{ ok: number }>();
  return row != null;
}

/** Admin routes: valid bearer + role_admin. */
export async function requireAdmin(
  env: ApiEnv,
  authorization: string | undefined,
): Promise<{ accountId: string } | Response> {
  const auth = await requireBearer(env, authorization);
  if (auth instanceof Response) return auth;
  if (!(await userHasRole(env, auth.accountId, "role_admin"))) {
    return forbidden();
  }
  return auth;
}
