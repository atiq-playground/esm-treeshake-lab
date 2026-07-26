import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextResponse } from "next/server";
import { CSRF_HEADER } from "@/lib/auth/constants";

const resolveSession = vi.fn();
const revokeAllSessions = vi.fn();
const listSessions = vi.fn();
const getUsers = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  resolveSession: (...args: unknown[]) => resolveSession(...args),
}));

vi.mock("@service/token-admin", () => ({
  TokenAdminService: {
    revokeAllSessions: (...args: unknown[]) => revokeAllSessions(...args),
    listSessions: (...args: unknown[]) => listSessions(...args),
  },
}));

vi.mock("@service/account-admin", () => ({
  AccountAdminService: {
    getUsers: (...args: unknown[]) => getUsers(...args),
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name.includes("csrf") ? { value: "csrf-token" } : undefined,
  })),
}));

describe("/api/sessions", () => {
  beforeEach(() => {
    resolveSession.mockReset();
    revokeAllSessions.mockReset();
    listSessions.mockReset();
    getUsers.mockReset();
    resolveSession.mockResolvedValue({
      session: {
        authenticated: true,
        accountId: "123",
        displayName: "Demo User",
      },
      accessToken: "access-token",
    });
  });

  it("GET returns active session counts per account", async () => {
    const now = Math.floor(Date.now() / 1000);
    getUsers.mockResolvedValue([
      { id: "123", email: "demo@example.com", displayName: "Demo User" },
      {
        id: "a418bf1d-2bb0-45c7-aaf3-9a267580a47f",
        email: "user2@example.com",
        displayName: "Plain User 2",
      },
    ]);
    listSessions.mockImplementation(async (accountId: string) => {
      if (accountId === "123") {
        return [
          { revoked: 0, expires_at: now + 60 },
          { revoked: 1, expires_at: now + 60 },
        ];
      }
      return [{ revoked: 0, expires_at: now + 120 }];
    });

    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      counts: {
        "123": 1,
        "a418bf1d-2bb0-45c7-aaf3-9a267580a47f": 1,
      },
    });
  });

  it("revokes all sessions for the signed-in account and clears cookies", async () => {
    revokeAllSessions.mockResolvedValue(undefined);

    const { DELETE } = await import("./route");
    const res = (await DELETE(
      new Request("http://localhost/api/sessions", {
        method: "DELETE",
        headers: { [CSRF_HEADER]: "csrf-token" },
      }),
    )) as NextResponse;

    expect(resolveSession).toHaveBeenCalledWith({ allowRotate: true });
    expect(revokeAllSessions).toHaveBeenCalledWith("123", "access-token");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      accountId: "123",
      clearedSelf: true,
    });

    const access =
      res.cookies.get("access") ?? res.cookies.get("__Host-access");
    expect(access?.value).toBe("");
  });

  it("revokes another account without clearing the admin cookies", async () => {
    revokeAllSessions.mockResolvedValue(undefined);

    const { DELETE } = await import("./route");
    const res = (await DELETE(
      new Request(
        "http://localhost/api/sessions?accountId=a418bf1d-2bb0-45c7-aaf3-9a267580a47f",
        {
          method: "DELETE",
          headers: { [CSRF_HEADER]: "csrf-token" },
        },
      ),
    )) as NextResponse;

    expect(revokeAllSessions).toHaveBeenCalledWith(
      "a418bf1d-2bb0-45c7-aaf3-9a267580a47f",
      "access-token",
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      accountId: "a418bf1d-2bb0-45c7-aaf3-9a267580a47f",
      clearedSelf: false,
    });

    const access =
      res.cookies.get("access") ?? res.cookies.get("__Host-access");
    expect(access).toBeUndefined();
  });

  it("returns 403 when admin revoke fails", async () => {
    revokeAllSessions.mockRejectedValue(new Error("forbidden"));

    const { DELETE } = await import("./route");
    const res = await DELETE(
      new Request("http://localhost/api/sessions", {
        method: "DELETE",
        headers: { [CSRF_HEADER]: "csrf-token" },
      }),
    );

    expect(res.status).toBe(403);
  });
});
