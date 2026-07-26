"use client";

import type { ReactNode } from "react";
import {
  AccountProvider,
  type AccountState,
} from "@/lib/account/account-provider";
import { AuthProvider } from "@/lib/auth/auth-provider";

export function Providers({
  account,
  children,
}: {
  account: AccountState | null;
  children: ReactNode;
}) {
  return (
    <AccountProvider initial={account}>
      <AuthProvider>{children}</AuthProvider>
    </AccountProvider>
  );
}
