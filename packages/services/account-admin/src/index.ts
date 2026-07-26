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

export type AdminUser = PublicUser & {
  dateOfBirth: string;
  status: "active" | "suspended";
  createdAt: string;
};

const UNUSED_GET_USER_PAYLOAD = {
  marker: "EXECUTING_ACCOUNT_ADMIN_GET_USER",
  ballast: "a".repeat(2048),
};

const UNUSED_CREATE_USER_PAYLOAD = {
  marker: "EXECUTING_ACCOUNT_ADMIN_CREATE_USER",
  ballast: "b".repeat(2048),
};

const UNUSED_UPDATE_USER_PAYLOAD = {
  marker: "EXECUTING_ACCOUNT_ADMIN_UPDATE_USER",
  ballast: "c".repeat(2048),
};

const UNUSED_SUSPEND_USER_PAYLOAD = {
  marker: "EXECUTING_ACCOUNT_ADMIN_SUSPEND_USER",
  ballast: "d".repeat(2048),
};

const UNUSED_UNSUSPEND_USER_PAYLOAD = {
  marker: "EXECUTING_ACCOUNT_ADMIN_UNSUSPEND_USER",
  ballast: "e".repeat(2048),
};

const UNUSED_RESET_PASSWORD_PAYLOAD = {
  marker: "EXECUTING_ACCOUNT_ADMIN_RESET_PASSWORD",
  ballast: "f".repeat(2048),
};

async function getUsers(accessToken: string): Promise<AdminUser[]> {
  const marker = "EXECUTING_ACCOUNT_ADMIN_GET_USERS";
  const { accountAdminApiUrl } = getAppConfig();
  const res = await request(joinUrl(accountAdminApiUrl, `/v1/admin/users`), {
    headers: {
      Accept: "application/json",
      "X-Lab-Marker": marker,
      Authorization: bearerAuthorization(accessToken),
    },
  });
  if (!res.ok) {
    throw new Error(`AccountAdminService.getUsers failed: ${res.status}`);
  }
  return (await res.json()) as AdminUser[];
}

async function getUser(id: string, accessToken: string): Promise<AdminUser> {
  void UNUSED_GET_USER_PAYLOAD;
  const { accountAdminApiUrl } = getAppConfig();
  const res = await request(
    joinUrl(accountAdminApiUrl, `/v1/admin/users/${id}`),
    {
      headers: {
        Accept: "application/json",
        Authorization: bearerAuthorization(accessToken),
      },
    },
  );
  if (!res.ok) {
    throw new Error(`AccountAdminService.getUser failed: ${res.status}`);
  }
  return (await res.json()) as AdminUser;
}

async function createUser(
  accessToken: string,
  input: {
    email: string;
    displayName: string;
    dateOfBirth: string;
  },
): Promise<AdminUser> {
  void UNUSED_CREATE_USER_PAYLOAD;
  const { accountAdminApiUrl } = getAppConfig();
  const res = await request(joinUrl(accountAdminApiUrl, `/v1/admin/users`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: bearerAuthorization(accessToken),
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`AccountAdminService.createUser failed: ${res.status}`);
  }
  return (await res.json()) as AdminUser;
}

async function updateUser(
  id: string,
  accessToken: string,
  patch: Partial<
    Pick<AdminUser, "email" | "displayName" | "dateOfBirth" | "status">
  >,
): Promise<AdminUser> {
  void UNUSED_UPDATE_USER_PAYLOAD;
  const { accountAdminApiUrl } = getAppConfig();
  const res = await request(
    joinUrl(accountAdminApiUrl, `/v1/admin/users/${id}`),
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: bearerAuthorization(accessToken),
      },
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) {
    throw new Error(`AccountAdminService.updateUser failed: ${res.status}`);
  }
  return (await res.json()) as AdminUser;
}

async function suspendUser(
  id: string,
  accessToken: string,
): Promise<AdminUser> {
  void UNUSED_SUSPEND_USER_PAYLOAD;
  return updateUser(id, accessToken, { status: "suspended" });
}

async function unsuspendUser(
  id: string,
  accessToken: string,
): Promise<AdminUser> {
  void UNUSED_UNSUSPEND_USER_PAYLOAD;
  return updateUser(id, accessToken, { status: "active" });
}

async function resetPassword(
  id: string,
  accessToken: string,
): Promise<{ ok: true }> {
  void UNUSED_RESET_PASSWORD_PAYLOAD;
  const { accountAdminApiUrl } = getAppConfig();
  const res = await request(
    joinUrl(accountAdminApiUrl, `/v1/admin/users/${id}/password-resets`),
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: bearerAuthorization(accessToken),
      },
    },
  );
  if (!res.ok) {
    throw new Error(`AccountAdminService.resetPassword failed: ${res.status}`);
  }
  return { ok: true };
}

export const AccountAdminService = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  suspendUser,
  unsuspendUser,
  resetPassword,
};
