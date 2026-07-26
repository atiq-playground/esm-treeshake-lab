import type { ApiEnv } from "./env";
import { nowIso } from "./time";

export async function writeAudit(
  env: ApiEnv,
  input: {
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    ip?: string | null;
    userAgent?: string | null;
  },
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO audit_logs
      (id, actor_id, action, entity_type, entity_id, before_json, after_json, ip, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      input.actorId ?? null,
      input.action,
      input.entityType,
      input.entityId,
      input.before == null ? null : JSON.stringify(input.before),
      input.after == null ? null : JSON.stringify(input.after),
      input.ip ?? null,
      input.userAgent ?? null,
      nowIso(),
    )
    .run();
}
