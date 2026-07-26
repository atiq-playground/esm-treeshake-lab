export type ApiEnv = {
  DB: D1Database;
  OIDC_SIGNING_SECRET: string;
  OIDC_CLIENT_SECRET: string;
  OIDC_ISSUER: string;
  OIDC_AUDIENCE: string;
  OIDC_CLIENT_ID: string;
};

export const TOKEN_TTL_SECONDS = 3600;
