import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import {
  clearAuthCookies,
  writeRotatedAuthCookies,
} from "./write-auth-cookies";

describe("writeRotatedAuthCookies / clearAuthCookies", () => {
  it("sets access, refresh, and id cookies on the response", () => {
    const res = NextResponse.json({ ok: true });
    writeRotatedAuthCookies(res, {
      access_token: "a1",
      refresh_token: "r1",
      id_token: "i1",
      expires_in: 3600,
      token_type: "Bearer",
    });

    const access = res.cookies.get("access") ?? res.cookies.get("__Host-access");
    const refresh =
      res.cookies.get("refresh") ?? res.cookies.get("__Host-refresh");
    const id = res.cookies.get("id") ?? res.cookies.get("__Host-id");

    expect(access?.value).toBe("a1");
    expect(refresh?.value).toBe("r1");
    expect(id?.value).toBe("i1");
  });

  it("clears auth cookies with maxAge 0", () => {
    const res = NextResponse.json({ ok: true });
    writeRotatedAuthCookies(res, {
      access_token: "a1",
      refresh_token: "r1",
      id_token: "i1",
      expires_in: 3600,
      token_type: "Bearer",
    });
    clearAuthCookies(res);

    const access = res.cookies.get("access") ?? res.cookies.get("__Host-access");
    expect(access?.value).toBe("");
  });
});
