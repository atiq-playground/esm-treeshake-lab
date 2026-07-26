"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useAccount } from "@/lib/account/account-provider";
import { CSRF_HEADER } from "@/lib/auth/constants";

type SessionJson =
  | {
      authenticated: true;
      accountId: string;
      displayName: string;
      rotated?: boolean;
    }
  | { authenticated: false; mayRace?: boolean };

type AuthContextValue = {
  session: SessionJson | undefined;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: (options?: { authGated?: boolean }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchSession(url: string): Promise<SessionJson> {
  const res = await fetch(url, { credentials: "include" });
  const data = (await res.json()) as SessionJson;
  if (data.authenticated) return data;

  // Only retry when the server says a refresh was attempted and failed —
  // logged-out visitors must not pay a 100ms penalty on every load.
  if (!data.mayRace) return data;

  await new Promise((r) => setTimeout(r, 100));
  const retry = await fetch(url, { credentials: "include" });
  return (await retry.json()) as SessionJson;
}

async function ensureCsrf(): Promise<string> {
  const res = await fetch("/api/auth", {
    method: "PUT",
    credentials: "include",
  });
  const data = (await res.json()) as { csrf: string };
  return data.csrf;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const account = useAccount();
  const { data, isLoading, mutate } = useSWR("/api/auth", fetchSession, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshInterval: 0,
  });

  // After /api/auth rotates cookies, re-run layout with the new jar.
  useEffect(() => {
    if (data?.authenticated && data.rotated) {
      router.refresh();
    }
  }, [data, router]);

  const login = useCallback(
    async (email: string, password: string) => {
      const csrf = await ensureCsrf();
      const res = await fetch("/api/auth", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          [CSRF_HEADER]: csrf,
        },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        throw new Error("login_failed");
      }
      const next = (await res.json()) as SessionJson;
      await mutate(next, { revalidate: false });
      router.refresh();
    },
    [mutate, router],
  );

  const logout = useCallback(
    async (options?: { authGated?: boolean }) => {
      const csrf = await ensureCsrf();
      await fetch("/api/auth", {
        method: "DELETE",
        credentials: "include",
        headers: { [CSRF_HEADER]: csrf },
      });
      account.clear();
      await mutate({ authenticated: false }, { revalidate: false });
      if (options?.authGated) {
        router.replace("/");
      }
    },
    [account, mutate, router],
  );

  const value = useMemo(
    () => ({
      session: data,
      isLoading,
      login,
      logout,
    }),
    [data, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
