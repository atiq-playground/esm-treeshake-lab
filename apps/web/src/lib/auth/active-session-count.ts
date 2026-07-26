import type { AdminSession } from "@service/token-admin";

/** Active = not revoked and not past expires_at. */
export function countActiveSessions(
  sessions: ReadonlyArray<Pick<AdminSession, "revoked" | "expires_at">>,
  nowUnixSeconds: number = Math.floor(Date.now() / 1000),
): number {
  return sessions.filter(
    (s) => s.revoked === 0 && s.expires_at > nowUnixSeconds,
  ).length;
}
