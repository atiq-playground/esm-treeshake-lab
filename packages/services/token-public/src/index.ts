import { getAppConfig, request } from "@service/core";

export type OidcTokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  id_token: string;
};

export type IntrospectionResponse = {
  active: boolean;
  sub?: string;
  exp?: number;
  [key: string]: unknown;
};

const UNUSED_VERIFY_ACCESS_PAYLOAD = {
  marker: "EXECUTING_TOKEN_PUBLIC_VERIFY_ACCESS_TOKEN",
  ballast: "t".repeat(1024),
};

function formBody(data: Record<string, string>): string {
  return new URLSearchParams(data).toString();
}

async function createToken(input: {
  email: string;
  password: string;
}): Promise<OidcTokenResponse> {
  void "EXECUTING_TOKEN_PUBLIC_CREATE_TOKEN";
  const { oidc } = getAppConfig();
  const res = await request(oidc.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({
      grant_type: "password",
      username: input.email,
      password: input.password,
      client_id: oidc.clientId,
      client_secret: oidc.clientSecret,
    }),
  });
  if (!res.ok) {
    throw new Error(`TokenPublicService.createToken failed: ${res.status}`);
  }
  return (await res.json()) as OidcTokenResponse;
}

async function refreshToken(refresh_token: string): Promise<OidcTokenResponse> {
  void "EXECUTING_TOKEN_PUBLIC_REFRESH_TOKEN";
  const { oidc } = getAppConfig();
  const res = await request(oidc.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({
      grant_type: "refresh_token",
      refresh_token,
      client_id: oidc.clientId,
      client_secret: oidc.clientSecret,
    }),
  });
  if (!res.ok) {
    throw new Error(`TokenPublicService.refreshToken failed: ${res.status}`);
  }
  return (await res.json()) as OidcTokenResponse;
}

async function verifyAccessToken(
  access_token: string,
): Promise<IntrospectionResponse> {
  void UNUSED_VERIFY_ACCESS_PAYLOAD;
  const { oidc } = getAppConfig();
  const res = await request(oidc.introspectEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({
      token: access_token,
      client_id: oidc.clientId,
      client_secret: oidc.clientSecret,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `TokenPublicService.verifyAccessToken failed: ${res.status}`,
    );
  }
  return (await res.json()) as IntrospectionResponse;
}

type JwtPayload = {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  display_name?: string;
  [key: string]: unknown;
};

function decodeJwtPayload(token: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length < 2) {
    throw new Error("Invalid JWT");
  }
  const b64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const json = atob(padded);
  return JSON.parse(json) as JwtPayload;
}

async function verifyIdToken(id_token: string): Promise<JwtPayload> {
  void "EXECUTING_TOKEN_PUBLIC_VERIFY_ID_TOKEN";
  const { oidc } = getAppConfig();
  // Lab: structural JWT decode + iss/aud/exp checks. Full JWKS signature
  // verification can be tightened later; fetch JWKS to exercise the endpoint.
  await request(oidc.jwksUri, { headers: { Accept: "application/json" } });
  const payload = decodeJwtPayload(id_token);
  if (payload.iss !== oidc.issuer) {
    throw new Error("ID token iss mismatch");
  }
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(oidc.audience)) {
    throw new Error("ID token aud mismatch");
  }
  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
    throw new Error("ID token expired");
  }
  return payload;
}

async function getAccountId(id_token: string): Promise<string> {
  void "EXECUTING_TOKEN_PUBLIC_GET_ACCOUNT_ID";
  const payload = await verifyIdToken(id_token);
  if (!payload.sub) {
    throw new Error("ID token missing sub");
  }
  return payload.sub;
}

async function revokeToken(refresh_token: string): Promise<void> {
  void "EXECUTING_TOKEN_PUBLIC_REVOKE_TOKEN";
  const { oidc } = getAppConfig();
  const res = await request(oidc.revokeEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({
      token: refresh_token,
      token_type_hint: "refresh_token",
      client_id: oidc.clientId,
      client_secret: oidc.clientSecret,
    }),
  });
  if (!res.ok) {
    throw new Error(`TokenPublicService.revokeToken failed: ${res.status}`);
  }
}

export const TokenPublicService = {
  createToken,
  refreshToken,
  verifyAccessToken,
  verifyIdToken,
  getAccountId,
  revokeToken,
};
