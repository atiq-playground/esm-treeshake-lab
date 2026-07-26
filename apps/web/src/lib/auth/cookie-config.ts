import { CSRF_HEADER } from "./constants";

export const ACCESS_COOKIE = "__Host-access";
export const REFRESH_COOKIE = "__Host-refresh";
export const ID_COOKIE = "__Host-id";
export const CSRF_COOKIE = "__Host-csrf";
export { CSRF_HEADER };

const secure =
  process.env.COOKIE_SECURE === "0"
    ? false
    : process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "1";

/** Prefer __Host- when Secure; fall back to plain names for local http. */
export function cookieNames() {
  if (secure) {
    return {
      access: ACCESS_COOKIE,
      refresh: REFRESH_COOKIE,
      id: ID_COOKIE,
      csrf: CSRF_COOKIE,
    };
  }
  return {
    access: "access",
    refresh: "refresh",
    id: "id",
    csrf: "csrf",
  };
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export { secure as cookiesAreSecure };
