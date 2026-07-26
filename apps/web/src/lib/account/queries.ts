import "server-only";

import { AccountPublicService } from "@service/account-public";
import type { PublicUser } from "@service/account-public";
import { AccountAdminService } from "@service/account-admin";
import type { AdminUser } from "@service/account-admin";

export async function getCurrentUser(
  accountId: string,
  accessToken: string,
): Promise<PublicUser> {
  return AccountPublicService.getUser(accountId, accessToken);
}

export async function listUsers(accessToken: string): Promise<AdminUser[]> {
  return AccountAdminService.getUsers(accessToken);
}
