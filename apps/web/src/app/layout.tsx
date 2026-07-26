import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { resolveSession } from "@/lib/auth/session";
import { getCurrentUser, listUsers } from "@/lib/account/queries";
import type { AccountState } from "@/lib/account/account-provider";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ESM tree-shake lab",
  description: "Nx + Bun monorepo lab for Service SDK tree-shaking",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Never rotate here — RSC cannot Set-Cookie; only GET /api/auth opts into rotation.
  const { session, accessToken } = await resolveSession();

  let account: AccountState | null = session.authenticated
    ? null
    : { currentUser: null, users: [] };

  if (session.authenticated && accessToken) {
    try {
      const [currentUser, users] = await Promise.all([
        getCurrentUser(session.accountId, accessToken),
        listUsers(accessToken),
      ]);
      account = { currentUser, users };
    } catch {
      // Do not seed empty account over a live client session on transient failure.
      account = null;
    }
  }

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <Providers account={account}>{children}</Providers>
      </body>
    </html>
  );
}
