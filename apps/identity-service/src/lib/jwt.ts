import { SignJWT } from "jose";
import type { ApiEnv } from "./env";
import { TOKEN_TTL_SECONDS } from "./env";

export async function mintIdToken(
  env: ApiEnv,
  user: { id: string; display_name: string },
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ display_name: user.display_name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(env.OIDC_ISSUER)
    .setSubject(user.id)
    .setAudience(env.OIDC_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + TOKEN_TTL_SECONDS)
    .sign(new TextEncoder().encode(env.OIDC_SIGNING_SECRET));
}
