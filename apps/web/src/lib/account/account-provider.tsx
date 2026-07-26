"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AdminUser, PublicUser } from "./types";

export type AccountState = {
  currentUser: PublicUser | null;
  users: AdminUser[];
};

type AccountContextValue = AccountState & {
  clear: () => void;
  seed: (next: AccountState) => void;
};

const AccountContext = createContext<AccountContextValue | null>(null);

const empty: AccountState = { currentUser: null, users: [] };

export function AccountProvider({
  initial,
  children,
}: {
  /** null = do not overwrite client account state (e.g. layout fetch failed). */
  initial: AccountState | null;
  children: ReactNode;
}) {
  const [state, setState] = useState<AccountState>(initial ?? empty);

  // Layout re-seeds via router.refresh(); useState alone ignores later prop updates.
  // null means "no seed" so a failed SSR account fetch cannot wipe client state.
  useEffect(() => {
    if (initial !== null) {
      setState(initial);
    }
  }, [initial]);

  const clear = useCallback(() => {
    setState(empty);
  }, []);

  const seed = useCallback((next: AccountState) => {
    setState(next);
  }, []);

  const value = useMemo(
    () => ({ ...state, clear, seed }),
    [state, clear, seed],
  );

  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) {
    throw new Error("useAccount must be used within AccountProvider");
  }
  return ctx;
}
