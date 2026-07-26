import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { TokenPublicService } from "@service/token-public";
import {
  cookieNames,
  cookieOptions,
  CSRF_HEADER,
} from "@/lib/auth/cookies";
import { resolveSession } from "@/lib/auth/session";
import {
  clearAuthCookies,
  writeRotatedAuthCookies,
} from "@/lib/auth/write-auth-cookies";

function randomToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

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

export async function GET() {
  const resolved = await resolveSession({ allowRotate: true });
  const body = resolved.session.authenticated
    ? { ...resolved.session, rotated: Boolean(resolved.rotated) }
    : {
        authenticated: false as const,
        // Signal concurrent-tab race: refresh was tried and failed.
        ...(resolved.refreshFailed ? { mayRace: true as const } : {}),
      };
  const res = NextResponse.json(body, {
    status: resolved.session.authenticated ? 200 : 401,
  });

  if (resolved.rotated) {
    writeRotatedAuthCookies(res, resolved.rotated);
  }
  // Never clear cookies on GET. Concurrent tabs can race refresh rotation;
  // the loser must not Set-Cookie-clear the winner's newly issued jar.
  // Logout (DELETE) is the only path that clears.

  return res;
}

export async function POST(req: Request) {
  const jar = await cookies();
  try {
    assertCsrf(req, jar);
  } catch (response) {
    if (response instanceof Response) return response;
    throw response;
  }

  const body = (await req.json()) as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const tokens = await TokenPublicService.createToken({
      email: body.email,
      password: body.password,
    });
    const verified = await TokenPublicService.verifyIdToken(tokens.id_token);
    if (!verified.sub) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    const displayName =
      typeof verified.display_name === "string"
        ? verified.display_name
        : "User";

    const res = NextResponse.json({
      authenticated: true,
      accountId: verified.sub,
      displayName,
    });
    writeRotatedAuthCookies(res, tokens);
    return res;
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}

export async function DELETE(req: Request) {
  const jar = await cookies();
  try {
    assertCsrf(req, jar);
  } catch (response) {
    if (response instanceof Response) return response;
    throw response;
  }

  const names = cookieNames();
  const refresh = jar.get(names.refresh)?.value;
  if (refresh) {
    try {
      await TokenPublicService.revokeToken(refresh);
    } catch {
      // still clear cookies
    }
  }

  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res);
  return res;
}

/** Issue CSRF cookie for double-submit (readable by JS). */
export async function PUT() {
  const names = cookieNames();
  const token = randomToken();
  const res = NextResponse.json({ csrf: token });
  res.cookies.set(names.csrf, token, {
    ...cookieOptions(60 * 60 * 24),
    httpOnly: false,
  });
  return res;
}
