import {
  bearerAuthorization,
  getAppConfig,
  joinUrl,
  request,
} from "@service/core";

// Admin token API base is AUTH_ADMIN_API_URL — passed via oidc-adjacent config.
// We read tokenEndpoint origin + /admin/api from env composition at setAppConfig time
// by storing authAdminApiUrl on config... For now derive from tokenEndpoint host.

function authAdminBase(): string {
  const { oidc } = getAppConfig();
  // tokenEndpoint is `${AUTH_PUBLIC_API_URL}/oauth/token`
  // AUTH_PUBLIC_API_URL ends with /public/api → admin is sibling /admin/api
  const publicApi = oidc.tokenEndpoint.replace(/\/oauth\/token$/, "");
  return publicApi.replace(/\/public\/api$/, "/admin/api");
}

const UNUSED_CREATE_TOKEN_PAYLOAD = {
  marker: "EXECUTING_TOKEN_ADMIN_CREATE_TOKEN_FOR_ACCOUNT",
  ballast: "u".repeat(1024),
};

const UNUSED_LIST_SESSIONS_PAYLOAD = {
  marker: "EXECUTING_TOKEN_ADMIN_LIST_SESSIONS",
  ballast: "v".repeat(1024),
};

const UNUSED_REVOKE_TOKEN_PAYLOAD = {
  marker: "EXECUTING_TOKEN_ADMIN_REVOKE_TOKEN",
  ballast: "w".repeat(1024),
};

const UNUSED_REVOKE_ALL_PAYLOAD = {
  marker: "EXECUTING_TOKEN_ADMIN_REVOKE_ALL_SESSIONS",
  ballast: "x".repeat(1024),
};

const UNUSED_INSPECT_PAYLOAD = {
  marker: "EXECUTING_TOKEN_ADMIN_INSPECT_TOKEN",
  ballast: "y".repeat(1024),
};

async function createTokenForAccount(
  accountId: string,
  accessToken: string,
): Promise<unknown> {
  void UNUSED_CREATE_TOKEN_PAYLOAD;
  const res = await request(
    joinUrl(authAdminBase(), `/v1/accounts/${accountId}/tokens`),
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: bearerAuthorization(accessToken),
      },
    },
  );
  if (!res.ok) {
    throw new Error(
      `TokenAdminService.createTokenForAccount failed: ${res.status}`,
    );
  }
  return res.json();
}

async function listSessions(
  accountId: string,
  accessToken: string,
): Promise<unknown[]> {
  void UNUSED_LIST_SESSIONS_PAYLOAD;
  const res = await request(
    joinUrl(authAdminBase(), `/v1/accounts/${accountId}/sessions`),
    {
      headers: {
        Accept: "application/json",
        Authorization: bearerAuthorization(accessToken),
      },
    },
  );
  if (!res.ok) {
    throw new Error(`TokenAdminService.listSessions failed: ${res.status}`);
  }
  return (await res.json()) as unknown[];
}

async function revokeToken(
  tokenOrSessionId: string,
  accessToken: string,
): Promise<void> {
  void UNUSED_REVOKE_TOKEN_PAYLOAD;
  const res = await request(
    joinUrl(authAdminBase(), `/v1/sessions/${tokenOrSessionId}`),
    {
      method: "DELETE",
      headers: { Authorization: bearerAuthorization(accessToken) },
    },
  );
  if (!res.ok) {
    throw new Error(`TokenAdminService.revokeToken failed: ${res.status}`);
  }
}

async function revokeAllSessions(
  accountId: string,
  accessToken: string,
): Promise<void> {
  void UNUSED_REVOKE_ALL_PAYLOAD;
  const res = await request(
    joinUrl(authAdminBase(), `/v1/accounts/${accountId}/sessions`),
    {
      method: "DELETE",
      headers: { Authorization: bearerAuthorization(accessToken) },
    },
  );
  if (!res.ok) {
    throw new Error(
      `TokenAdminService.revokeAllSessions failed: ${res.status}`,
    );
  }
}

async function inspectToken(
  token: string,
  accessToken: string,
): Promise<unknown> {
  void UNUSED_INSPECT_PAYLOAD;
  const res = await request(joinUrl(authAdminBase(), `/v1/tokens/${token}`), {
    headers: {
      Accept: "application/json",
      Authorization: bearerAuthorization(accessToken),
    },
  });
  if (!res.ok) {
    throw new Error(`TokenAdminService.inspectToken failed: ${res.status}`);
  }
  return res.json();
}

export const TokenAdminService = {
  createTokenForAccount,
  listSessions,
  revokeToken,
  revokeAllSessions,
  inspectToken,
};
