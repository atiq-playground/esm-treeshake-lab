"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAccount } from "@/lib/account/account-provider";
import styles from "@/app/page.module.css";

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className={styles.codeBlock}>
      {value == null ? "null" : JSON.stringify(value, null, 2)}
    </pre>
  );
}

function formatSessionCount(count: number | undefined): string {
  if (count === undefined) return "Sessions unknown";
  if (count === 0) return "No active sessions";
  return count === 1 ? "1 active session" : `${count} active sessions`;
}

export function HomeClient() {
  const { session, isLoading, login, logout, clearSessions } = useAuth();
  const { currentUser, users } = useAccount();
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState<string | null>(null);
  const [sessionActionError, setSessionActionError] = useState<string | null>(
    null,
  );
  const [sessionActionOk, setSessionActionOk] = useState<string | null>(null);
  const [clearingAccountId, setClearingAccountId] = useState<string | null>(
    null,
  );
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>(
    {},
  );
  const [countsLoading, setCountsLoading] = useState(false);

  const refreshSessionCounts = useCallback(async () => {
    setCountsLoading(true);
    try {
      const res = await fetch("/api/sessions", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { counts?: Record<string, number> };
      setSessionCounts(data.counts ?? {});
    } finally {
      setCountsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.authenticated) {
      void refreshSessionCounts();
    } else {
      setSessionCounts({});
    }
  }, [session?.authenticated, refreshSessionCounts]);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>ESM tree-shake lab</h1>
        <p className={styles.lede}>
          Web imports both account packages; layout calls one method each.
        </p>

        {isLoading ? (
          <p className={styles.lede}>Loading session…</p>
        ) : session?.authenticated ? (
          <>
            <div className={styles.sessionBar}>
              <p className={styles.sessionMeta}>
                Signed in as {session.displayName}{" "}
                <code>{session.accountId}</code>
              </p>
              <div className={styles.actions}>
                <button type="button" onClick={() => void logout()}>
                  Sign out
                </button>
              </div>
            </div>

            <section className={styles.panel}>
              <h2>Current user (public SDK)</h2>
              <JsonBlock value={currentUser} />
            </section>

            <section className={styles.panel}>
              <h2>Users (admin SDK)</h2>
              {users.length === 0 ? (
                <p className={styles.lede}>No users loaded.</p>
              ) : (
                <ul className={styles.userList}>
                  {users.map((user) => {
                    const isSelf = user.id === session.accountId;
                    const activeCount = sessionCounts[user.id];
                    return (
                      <li key={user.id} className={styles.userRow}>
                        <div className={styles.userMeta}>
                          <span className={styles.userName}>
                            {user.displayName}
                            {isSelf ? " (you)" : ""}
                          </span>
                          <span className={styles.userDetail}>{user.email}</span>
                          <span className={styles.userDetail}>
                            {countsLoading && activeCount === undefined
                              ? "Loading session count"
                              : formatSessionCount(activeCount)}
                          </span>
                          <code className={styles.userId}>{user.id}</code>
                        </div>
                        <button
                          type="button"
                          aria-busy={clearingAccountId === user.id}
                          disabled={
                            clearingAccountId === user.id || activeCount === 0
                          }
                          onClick={() => {
                            setSessionActionError(null);
                            setSessionActionOk(null);
                            setClearingAccountId(user.id);
                            void clearSessions(user.id)
                              .then(async () => {
                                if (isSelf) return;
                                setSessionCounts((prev) => ({
                                  ...prev,
                                  [user.id]: 0,
                                }));
                                setSessionActionOk(
                                  `Cleared sessions for ${user.displayName}`,
                                );
                                await refreshSessionCounts();
                              })
                              .catch(() =>
                                setSessionActionError(
                                  `Clear sessions failed for ${user.displayName}`,
                                ),
                              )
                              .finally(() => setClearingAccountId(null));
                          }}
                        >
                          {clearingAccountId === user.id
                            ? "Clearing…"
                            : activeCount === 0
                              ? "No sessions"
                              : "Clear sessions"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {sessionActionError ? (
                <p className={styles.error}>{sessionActionError}</p>
              ) : null}
              {sessionActionOk ? (
                <p className={styles.ok}>{sessionActionOk}</p>
              ) : null}
              <JsonBlock value={users} />
            </section>
          </>
        ) : (
          <form
            className={styles.form}
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
            {error ? <p className={styles.error}>{error}</p> : null}
          </form>
        )}
      </main>
    </div>
  );
}
