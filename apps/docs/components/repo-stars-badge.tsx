"use client";

import Link from "next/link";
import { GitHubIcon } from "@/components/brand-icons";
import { formatStars } from "@/lib/format-stars";
import { SITE_LINKS } from "@/lib/site-links";

type Props = {
  stars: number | null;
};

/** Compact repo star chip — sits left of the search trigger. */
export function RepoStarsBadge({ stars }: Props) {
  return (
    <Link
      href={SITE_LINKS.repo}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={
        stars == null
          ? "View repository on GitHub"
          : `View repository on GitHub, ${formatStars(stars)} stars`
      }
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--border-visible)] bg-[color:var(--surface-raised)] px-2.5 py-1.5 text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--surface)]"
    >
      <GitHubIcon />
      <span className="lab-mono text-xs tabular-nums tracking-wide">
        {stars == null ? "★" : `★ ${formatStars(stars)}`}
      </span>
    </Link>
  );
}
