import "server-only";

import type { NextResponse } from "next/server";
import type { OidcTokenResponse } from "@service/token-public";
import { cookieNames, cookieOptions } from "./cookie-config";

const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

/** Write rotated auth cookies onto a Route Handler response. */
export function writeRotatedAuthCookies(
  res: NextResponse,
  tokens: OidcTokenResponse,
): void {
  const names = cookieNames();
  const shortLived = cookieOptions(tokens.expires_in);
  res.cookies.set(names.access, tokens.access_token, shortLived);
  res.cookies.set(names.id, tokens.id_token, shortLived);
  res.cookies.set(
    names.refresh,
    tokens.refresh_token,
    cookieOptions(REFRESH_MAX_AGE),
  );
}

export function clearAuthCookies(res: NextResponse): void {
  const names = cookieNames();
  const cleared = cookieOptions(0);
  res.cookies.set(names.access, "", cleared);
  res.cookies.set(names.refresh, "", cleared);
  res.cookies.set(names.id, "", cleared);
}
