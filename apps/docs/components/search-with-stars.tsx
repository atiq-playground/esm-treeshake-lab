"use client";

import type { ComponentProps } from "react";
import {
  FullSearchTrigger,
  SearchTrigger,
} from "fumadocs-ui/layouts/shared/slots/search-trigger";
import { RepoStarsBadge } from "@/components/repo-stars-badge";
import { useRepoStars } from "@/components/repo-stars-context";

/** Stable client slot: stars chip immediately left of full search. */
export function SearchFullWithStars(
  props: ComponentProps<typeof FullSearchTrigger>,
) {
  const stars = useRepoStars();
  return (
    <>
      <RepoStarsBadge stars={stars} />
      <FullSearchTrigger {...props} />
    </>
  );
}

/** Stable client slot: stars chip immediately left of compact search. */
export function SearchSmWithStars(
  props: ComponentProps<typeof SearchTrigger>,
) {
  const stars = useRepoStars();
  return (
    <>
      <RepoStarsBadge stars={stars} />
      <SearchTrigger {...props} />
    </>
  );
}
