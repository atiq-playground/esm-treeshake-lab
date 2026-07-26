import { RootProvider } from "fumadocs-ui/provider/next";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { RepoStarsProvider } from "@/components/repo-stars-context";
import { fetchRepoStars } from "@/lib/github-stars";
import "./global.css";

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const mono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
});

// Doto via CSS fallback stack when available; Space Mono carries display.
export default async function Layout({ children }: { children: ReactNode }) {
  const stars = await fetchRepoStars();

  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} dark`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <RootProvider
          theme={{
            defaultTheme: "dark",
            enabled: true,
          }}
        >
          <RepoStarsProvider stars={stars}>{children}</RepoStarsProvider>
        </RootProvider>
      </body>
    </html>
  );
}
