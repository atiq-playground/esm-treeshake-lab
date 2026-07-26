import "server-only";

import { cookies } from "next/headers";
import {
  TokenPublicService,
  type OidcTokenResponse,
} from "@service/token-public";
import { cookieNames } from "./cookie-config";

export type AuthSession =
  | { authenticated: true; accountId: string; displayName: string }
  | { authenticated: false };

export type ResolvedAuth = {
  session: AuthSession;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  rotated?: OidcTokenResponse;
  /** True when a refresh grant was attempted and failed (client may retry once). */
  refreshFailed?: boolean;
};

export type ResolveSessionOptions = {
  /**
   * When true, expired/invalid ID tokens may trigger refresh-token rotation.
   * Defaults to false — only Route Handlers that persist cookies should opt in.
   */
  allowRotate?: boolean;
};

async function sessionFromIdToken(idToken: string): Promise<AuthSession> {
  const verified = await TokenPublicService.verifyIdToken(idToken);
  if (!verified.sub) {
    throw new Error("ID token missing sub");
  }
  const displayName =
    typeof verified.display_name === "string" ? verified.display_name : "User";
  return {
    authenticated: true,
    accountId: verified.sub,
    displayName,
  };
}

async function accessStillActive(access: string | undefined): Promise<boolean> {
  if (!access) return false;
  try {
    const intro = await TokenPublicService.verifyAccessToken(access);
    return intro.active === true;
  } catch {
    return false;
  }
}

export async function resolveSession(
  options: ResolveSessionOptions = {},
): Promise<ResolvedAuth> {
  const allowRotate = options.allowRotate === true;
  const jar = await cookies();
  const names = cookieNames();
  let access = jar.get(names.access)?.value;
  const refresh = jar.get(names.refresh)?.value;
  let id = jar.get(names.id)?.value;

  if (!id && !refresh) {
    return { session: { authenticated: false } };
  }

  if (id) {
    try {
      const session = await sessionFromIdToken(id);
      // RSC path: trust a valid ID cookie (cannot rotate/Set-Cookie here).
      if (!allowRotate) {
        return {
          session,
          accessToken: access,
          refreshToken: refresh,
          idToken: id,
        };
      }
      // Route path: another tab may have rotated — ID JWT can still look valid
      // while access/refresh were revoked. Only skip refresh when access is live.
      if (await accessStillActive(access)) {
        return {
          session,
          accessToken: access,
          refreshToken: refresh,
          idToken: id,
        };
      }
      // fall through to refresh when allowed
    } catch {
      // try refresh below when allowed
    }
  }

  if (refresh && allowRotate) {
    try {
      const tokens = await TokenPublicService.refreshToken(refresh);
      access = tokens.access_token;
      id = tokens.id_token;
      const session = await sessionFromIdToken(id);
      return {
        session,
        accessToken: access,
        refreshToken: tokens.refresh_token,
        idToken: id,
        rotated: tokens,
      };
    } catch {
      return { session: { authenticated: false }, refreshFailed: true };
    }
  }

  return { session: { authenticated: false } };
}
