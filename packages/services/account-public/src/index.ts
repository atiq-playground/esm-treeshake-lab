import {
  bearerAuthorization,
  getAppConfig,
  joinUrl,
  request,
} from "@service/core";

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
};

const UNUSED_UPDATE_PROFILE_PAYLOAD = {
  marker: "EXECUTING_ACCOUNT_PUBLIC_UPDATE_PROFILE",
  ballast: "x".repeat(2048),
};

const UNUSED_CHANGE_PASSWORD_PAYLOAD = {
  marker: "EXECUTING_ACCOUNT_PUBLIC_CHANGE_PASSWORD",
  ballast: "y".repeat(2048),
};

const UNUSED_EMAIL_VERIFICATION_PAYLOAD = {
  marker: "EXECUTING_ACCOUNT_PUBLIC_REQUEST_EMAIL_VERIFICATION",
  ballast: "z".repeat(2048),
};

async function getUser(
  id: string,
  accessToken: string,
): Promise<PublicUser> {
  const marker = "EXECUTING_ACCOUNT_PUBLIC_GET_USER";
  const { accountPublicApiUrl } = getAppConfig();
  const res = await request(joinUrl(accountPublicApiUrl, `/v1/users/${id}`), {
    headers: {
      Accept: "application/json",
      "X-Lab-Marker": marker,
      Authorization: bearerAuthorization(accessToken),
    },
  });
  if (!res.ok) {
    throw new Error(`AccountPublicService.getUser failed: ${res.status}`);
  }
  return (await res.json()) as PublicUser;
}

async function updateProfile(
  id: string,
  accessToken: string,
  patch: Partial<Pick<PublicUser, "email" | "displayName">>,
): Promise<PublicUser> {
  void UNUSED_UPDATE_PROFILE_PAYLOAD;
  const { accountPublicApiUrl } = getAppConfig();
  const res = await request(joinUrl(accountPublicApiUrl, `/v1/users/${id}`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: bearerAuthorization(accessToken),
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new Error(`AccountPublicService.updateProfile failed: ${res.status}`);
  }
  return (await res.json()) as PublicUser;
}

async function changePassword(
  id: string,
  accessToken: string,
  input: { currentPassword: string; newPassword: string },
): Promise<{ ok: true }> {
  void UNUSED_CHANGE_PASSWORD_PAYLOAD;
  const { accountPublicApiUrl } = getAppConfig();
  const res = await request(
    joinUrl(accountPublicApiUrl, `/v1/users/${id}/password`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: bearerAuthorization(accessToken),
      },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) {
    throw new Error(`AccountPublicService.changePassword failed: ${res.status}`);
  }
  return { ok: true };
}

async function requestEmailVerification(
  id: string,
  accessToken: string,
): Promise<{ ok: true }> {
  void UNUSED_EMAIL_VERIFICATION_PAYLOAD;
  const { accountPublicApiUrl } = getAppConfig();
  const res = await request(
    joinUrl(accountPublicApiUrl, `/v1/users/${id}/email-verifications`),
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
      `AccountPublicService.requestEmailVerification failed: ${res.status}`,
    );
  }
  return { ok: true };
}

export const AccountPublicService = {
  getUser,
  updateProfile,
  changePassword,
  requestEmailVerification,
};
