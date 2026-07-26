import { describe, expect, it } from "vitest";
import { countActiveSessions } from "./active-session-count";

describe("countActiveSessions", () => {
  const now = 1_700_000_000;

  it("counts only non-revoked, unexpired sessions", () => {
    expect(
      countActiveSessions(
        [
          { revoked: 0, expires_at: now + 60 },
          { revoked: 1, expires_at: now + 60 },
          { revoked: 0, expires_at: now - 1 },
          { revoked: 0, expires_at: now + 1 },
        ],
        now,
      ),
    ).toBe(2);
  });
});
