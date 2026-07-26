import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveSession = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  resolveSession: (...args: unknown[]) => resolveSession(...args),
}));

vi.mock("@service/token-public", () => ({
  TokenPublicService: {
    createToken: vi.fn(),
    verifyIdToken: vi.fn(),
    getAccountId: vi.fn(),
    revokeToken: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(),
  })),
}));

describe("GET /api/auth cookie rewrite", () => {
  beforeEach(() => {
    resolveSession.mockReset();
  });

  it("writes rotated cookies when resolveSession rotates", async () => {
    resolveSession.mockResolvedValue({
      session: {
        authenticated: true,
        accountId: "123",
        displayName: "Demo User",
      },
      accessToken: "new-access",
      refreshToken: "new-refresh",
      idToken: "new-id",
      rotated: {
        access_token: "new-access",
        refresh_token: "new-refresh",
        id_token: "new-id",
        expires_in: 3600,
      },
    });

    const { GET } = await import("./route");
    const res = await GET();

    expect(resolveSession).toHaveBeenCalledWith({ allowRotate: true });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      authenticated: true,
      accountId: "123",
      rotated: true,
    });

    const access =
      res.cookies.get("access") ?? res.cookies.get("__Host-access");
    const refresh =
      res.cookies.get("refresh") ?? res.cookies.get("__Host-refresh");
    const id = res.cookies.get("id") ?? res.cookies.get("__Host-id");
    expect(access?.value).toBe("new-access");
    expect(refresh?.value).toBe("new-refresh");
    expect(id?.value).toBe("new-id");
  });

  it("does not clear cookies on unauthenticated GET (multi-tab race safe)", async () => {
    resolveSession.mockResolvedValue({
      session: { authenticated: false },
    });

    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ authenticated: false });

    const access =
      res.cookies.get("access") ?? res.cookies.get("__Host-access");
    expect(access).toBeUndefined();
  });

  it("signals mayRace when refresh failed so the client can retry once", async () => {
    resolveSession.mockResolvedValue({
      session: { authenticated: false },
      refreshFailed: true,
    });

    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      authenticated: false,
      mayRace: true,
    });
  });
});



