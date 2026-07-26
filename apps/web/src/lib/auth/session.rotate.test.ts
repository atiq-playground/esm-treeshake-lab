import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieGet = vi.fn();
const refreshToken = vi.fn();
const verifyIdToken = vi.fn();
const verifyAccessToken = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
}));

vi.mock("@service/token-public", () => ({
  TokenPublicService: {
    refreshToken: (...args: unknown[]) => refreshToken(...args),
    verifyIdToken: (...args: unknown[]) => verifyIdToken(...args),
    verifyAccessToken: (...args: unknown[]) => verifyAccessToken(...args),
  },
}));

describe("resolveSession rotation gating", () => {
  beforeEach(() => {
    cookieGet.mockReset();
    refreshToken.mockReset();
    verifyIdToken.mockReset();
    verifyAccessToken.mockReset();
  });

  it("defaults allowRotate to false (safe for layout/RSC)", async () => {
    cookieGet.mockImplementation((name: string) => {
      if (name === "id" || name === "__Host-id") {
        return { value: "expired-id" };
      }
      if (name === "refresh" || name === "__Host-refresh") {
        return { value: "refresh-token" };
      }
      return undefined;
    });
    verifyIdToken.mockRejectedValue(new Error("ID token expired"));

    const { resolveSession } = await import("./session");
    const resolved = await resolveSession();

    expect(refreshToken).not.toHaveBeenCalled();
    expect(resolved).toEqual({ session: { authenticated: false } });
  });

  it("rotates when ID is valid but access was revoked (other-tab race)", async () => {
    cookieGet.mockImplementation((name: string) => {
      if (name === "id" || name === "__Host-id") {
        return { value: "still-valid-id" };
      }
      if (name === "access" || name === "__Host-access") {
        return { value: "revoked-access" };
      }
      if (name === "refresh" || name === "__Host-refresh") {
        return { value: "refresh-token" };
      }
      return undefined;
    });
    verifyIdToken.mockResolvedValue({ sub: "123", display_name: "Demo User" });
    verifyAccessToken.mockResolvedValue({ active: false });
    refreshToken.mockResolvedValue({
      access_token: "a2",
      refresh_token: "r2",
      id_token: "i2",
      expires_in: 3600,
      token_type: "Bearer",
    });

    const { resolveSession } = await import("./session");
    const resolved = await resolveSession({ allowRotate: true });

    expect(verifyAccessToken).toHaveBeenCalledWith("revoked-access");
    expect(refreshToken).toHaveBeenCalledWith("refresh-token");
    expect(resolved.rotated).toMatchObject({
      access_token: "a2",
      refresh_token: "r2",
      id_token: "i2",
    });
    expect(resolved.session).toEqual({
      authenticated: true,
      accountId: "123",
      displayName: "Demo User",
    });
  });

  it("skips refresh when allowRotate and access is still active", async () => {
    cookieGet.mockImplementation((name: string) => {
      if (name === "id" || name === "__Host-id") {
        return { value: "valid-id" };
      }
      if (name === "access" || name === "__Host-access") {
        return { value: "live-access" };
      }
      return undefined;
    });
    verifyIdToken.mockResolvedValue({ sub: "123", display_name: "Demo User" });
    verifyAccessToken.mockResolvedValue({ active: true });

    const { resolveSession } = await import("./session");
    const resolved = await resolveSession({ allowRotate: true });

    expect(refreshToken).not.toHaveBeenCalled();
    expect(resolved.session).toEqual({
      authenticated: true,
      accountId: "123",
      displayName: "Demo User",
    });
  });

  it("sets refreshFailed when rotation is attempted and fails", async () => {
    cookieGet.mockImplementation((name: string) => {
      if (name === "refresh" || name === "__Host-refresh") {
        return { value: "dead-refresh" };
      }
      return undefined;
    });
    refreshToken.mockRejectedValue(new Error("invalid_grant"));

    const { resolveSession } = await import("./session");
    const resolved = await resolveSession({ allowRotate: true });

    expect(resolved).toEqual({
      session: { authenticated: false },
      refreshFailed: true,
    });
  });
});
