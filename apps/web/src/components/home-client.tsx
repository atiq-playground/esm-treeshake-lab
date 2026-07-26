"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAccount } from "@/lib/account/account-provider";
import styles from "@/app/page.module.css";

export function HomeClient() {
  const { session, isLoading, login, logout } = useAuth();
  const { currentUser, users } = useAccount();
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>ESM tree-shake lab</h1>
        <p>Web imports both account packages; layout calls one method each.</p>

        {isLoading ? (
          <p>Loading session…</p>
        ) : session?.authenticated ? (
          <section>
            <p>
              Signed in as {session.displayName} ({session.accountId})
            </p>
            <button type="button" onClick={() => void logout()}>
              Sign out
            </button>
            <h2>Current user (public SDK)</h2>
            <pre>{JSON.stringify(currentUser, null, 2)}</pre>
            <h2>Users (admin SDK)</h2>
            <pre>{JSON.stringify(users, null, 2)}</pre>
          </section>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              void login(email, password).catch(() =>
                setError("Login failed"),
              );
            }}
          >
            <label>
              Email
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <button type="submit">Sign in</button>
            {error ? <p>{error}</p> : null}
          </form>
        )}
      </main>
    </div>
  );
}
