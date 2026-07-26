import { source } from "@/lib/source";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { docsOptions } from "@/lib/layout.shared";
import { fetchRepoStars } from "@/lib/github-stars";
import type { ReactNode } from "react";

export default async function Layout({ children }: { children: ReactNode }) {
  const stars = await fetchRepoStars();
  return (
    <DocsLayout tree={source.getPageTree()} {...docsOptions({ stars })}>
      {children}
    </DocsLayout>
  );
}
