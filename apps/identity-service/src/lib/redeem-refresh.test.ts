import { beforeEach, describe, expect, it, vi } from "vitest";

const hashToken = vi.fn(async (t: string) => `hash:${t}`);
const randomOpaqueToken = vi.fn(() => "opaque-token");
const sealJson = vi.fn(async (_s: string, v: unknown) => `sealed:${JSON.stringify(v)}`);
const unsealJson = vi.fn(
  async (_s: string, sealed: string) =>
    JSON.parse(sealed.replace(/^sealed:/, "")) as unknown,
);
const mintIdToken = vi.fn(async () => "id.jwt.token");
const nowUnix = vi.fn(() => 1_700_000_100);
const findUserById = vi.fn();

vi.mock("./crypto", () => ({
  hashToken: (t: string) => hashToken(t),
  randomOpaqueToken: () => randomOpaqueToken(),
  sealJson: (s: string, v: unknown) => sealJson(s, v),
  unsealJson: (s: string, sealed: string) => unsealJson(s, sealed),
}));

vi.mock("./jwt", () => ({
  mintIdToken: (env: unknown, user: unknown) => mintIdToken(env, user),
}));

vi.mock("./time", () => ({
  nowUnix: () => nowUnix(),
}));

vi.mock("./users", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./users")>();
  return {
    ...actual,
    findUserById: (env: unknown, id: string) => findUserById(env, id),
  };
});

describe("redeemRefreshToken", () => {
  beforeEach(() => {
    hashToken.mockClear();
    randomOpaqueToken.mockReset().mockReturnValue("opaque-token");
    sealJson.mockClear();
    unsealJson.mockClear();
    mintIdToken.mockReset().mockResolvedValue("id.jwt.token");
    nowUnix.mockReturnValue(1_700_000_100);
    findUserById.mockReset();
  });

  it("CAS-rotates an active refresh and seals a TTL replay blob", async () => {
    const insertRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const updateRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const activeFirst = vi.fn().mockResolvedValue({
      id: "sess-old",
      account_id: "123",
      family_id: "fam-1",
    });

    const prepare = vi.fn((sql: string) => {
      if (sql.includes("INSERT INTO sessions")) {
        return { bind: vi.fn().mockReturnValue({ run: insertRun }) };
      }
      if (sql.includes("WHERE id = ? AND revoked = 0")) {
        return { bind: vi.fn().mockReturnValue({ run: updateRun }) };
      }
      return { bind: vi.fn().mockReturnValue({ first: activeFirst }) };
    });

    findUserById.mockResolvedValue({
      id: "123",
      email: "demo@example.com",
      display_name: "Demo",
      status: "active",
    });

    const env = {
      DB: { prepare },
      OIDC_SIGNING_SECRET: "test-secret",
    } as unknown as Parameters<
      typeof import("./sessions").redeemRefreshToken
    >[0];

    const { redeemRefreshToken } = await import("./sessions");
    const result = await redeemRefreshToken(env, "refresh-1");

    expect(result?.replayed).toBe(false);
    expect(result?.tokens.refresh_token).toBe("opaque-token");
    expect(sealJson).toHaveBeenCalled();
    expect(updateRun).toHaveBeenCalled();
  });

  it("replays sealed tokens during grace without minting again", async () => {
    const cached = {
      access_token: "a-cached",
      token_type: "Bearer" as const,
      expires_in: 3600,
      refresh_token: "r-cached",
      id_token: "i-cached",
    };
    const activeFirst = vi.fn().mockResolvedValue(null);
    const graceFirst = vi.fn().mockResolvedValue({
      id: "sess-old",
      account_id: "123",
      family_id: "fam-1",
      rotation_response_json: `sealed:${JSON.stringify(cached)}`,
      rotation_replay_until: 1_700_000_200,
    });

    let call = 0;
    const prepare = vi.fn(() => {
      call += 1;
      return {
        bind: vi.fn().mockReturnValue({
          first: call === 1 ? activeFirst : graceFirst,
        }),
      };
    });

    unsealJson.mockResolvedValue(cached);

    const env = {
      DB: { prepare },
      OIDC_SIGNING_SECRET: "test-secret",
    } as unknown as Parameters<
      typeof import("./sessions").redeemRefreshToken
    >[0];

    const { redeemRefreshToken } = await import("./sessions");
    const result = await redeemRefreshToken(env, "refresh-1");

    expect(result).toEqual({
      tokens: cached,
      accountId: "123",
      sessionId: "sess-old",
      replayed: true,
    });
    expect(mintIdToken).not.toHaveBeenCalled();
  });

  it("wipes the session family when sealed replay is presented after grace", async () => {
    const activeFirst = vi.fn().mockResolvedValue(null);
    const graceFirst = vi.fn().mockResolvedValue({
      id: "sess-old",
      account_id: "123",
      family_id: "fam-1",
      rotation_response_json: "sealed:{}",
      rotation_replay_until: 1_700_000_000, // expired vs now 1_700_000_100
    });
    const wipeRun = vi.fn().mockResolvedValue({ meta: { changes: 2 } });

    let call = 0;
    const prepare = vi.fn((sql: string) => {
      call += 1;
      if (sql.includes("WHERE family_id = ?")) {
        return { bind: vi.fn().mockReturnValue({ run: wipeRun }) };
      }
      return {
        bind: vi.fn().mockReturnValue({
          first: call === 1 ? activeFirst : graceFirst,
        }),
      };
    });

    const env = {
      DB: { prepare },
      OIDC_SIGNING_SECRET: "test-secret",
    } as unknown as Parameters<
      typeof import("./sessions").redeemRefreshToken
    >[0];

    const { redeemRefreshToken } = await import("./sessions");
    await expect(redeemRefreshToken(env, "refresh-1")).resolves.toBeNull();
    expect(wipeRun).toHaveBeenCalled();
    expect(unsealJson).not.toHaveBeenCalled();
  });
});

describe("revokeByTokenHash", () => {
  it("wipes the family for a stale (already rotated) refresh hash", async () => {
    const familyFirst = vi.fn().mockResolvedValue({ family_id: "fam-1" });
    const wipeRun = vi.fn().mockResolvedValue({ meta: { changes: 2 } });
    const prepare = vi.fn((sql: string) => {
      if (sql.includes("WHERE family_id = ?")) {
        return { bind: vi.fn().mockReturnValue({ run: wipeRun }) };
      }
      return { bind: vi.fn().mockReturnValue({ first: familyFirst }) };
    });

    const env = {
      DB: { prepare },
      OIDC_SIGNING_SECRET: "test-secret",
    } as unknown as Parameters<
      typeof import("./sessions").revokeByTokenHash
    >[0];

    const { revokeByTokenHash } = await import("./sessions");
    await revokeByTokenHash(env, "hash:stale-refresh");
    expect(wipeRun).toHaveBeenCalled();
  });
});

