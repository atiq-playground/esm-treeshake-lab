import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AccountAdminService } from "@service/account-admin";
import { TokenAdminService } from "@service/token-admin";
import { cookieNames, CSRF_HEADER } from "@/lib/auth/cookies";
import { countActiveSessions } from "@/lib/auth/active-session-count";
import { resolveSession } from "@/lib/auth/session";
import {
  clearAuthCookies,
  writeRotatedAuthCookies,
} from "@/lib/auth/write-auth-cookies";

function assertCsrf(req: Request, jar: Awaited<ReturnType<typeof cookies>>) {
  const names = cookieNames();
  const cookieToken = jar.get(names.csrf)?.value;
  const headerToken = req.headers.get(CSRF_HEADER);
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    throw new Response(JSON.stringify({ error: "csrf" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export type SessionCountsResponse = {
  counts: Record<string, number>;
};

/** Admin-only: active session counts keyed by account id. */
export async function GET() {
  const resolved = await resolveSession({ allowRotate: true });
  if (!resolved.session.authenticated || !resolved.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const accessToken = resolved.accessToken;
  let users;
  try {
    users = await AccountAdminService.getUsers(accessToken);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const now = Math.floor(Date.now() / 1000);
  const entries = await Promise.all(
    users.map(async (user) => {
      try {
        const sessions = await TokenAdminService.listSessions(
          user.id,
          accessToken,
        );
        return [user.id, countActiveSessions(sessions, now)] as const;
      } catch {
        return [user.id, 0] as const;
      }
    }),
  );

  const body: SessionCountsResponse = {
    counts: Object.fromEntries(entries),
  };
  const res = NextResponse.json(body);
  if (resolved.rotated) {
    writeRotatedAuthCookies(res, resolved.rotated);
  }
  return res;
}

/** Admin-only: revoke all sessions for an account. Clears cookies when it's you. */
export async function DELETE(req: Request) {
  const jar = await cookies();
  try {
    assertCsrf(req, jar);
  } catch (response) {
    if (response instanceof Response) return response;
    throw response;
  }

  const resolved = await resolveSession({ allowRotate: true });
  if (!resolved.session.authenticated || !resolved.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const requestedId = new URL(req.url).searchParams.get("accountId");
  const accountId =
    requestedId && requestedId.trim().length > 0
      ? requestedId.trim()
      : resolved.session.accountId;

  try {
    await TokenAdminService.revokeAllSessions(
      accountId,
      resolved.accessToken,
    );
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const clearedSelf = accountId === resolved.session.accountId;
  const res = NextResponse.json({ ok: true, accountId, clearedSelf });
  if (clearedSelf) {
    clearAuthCookies(res);
  }
  return res;
}
