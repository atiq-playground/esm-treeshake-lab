"use client";

import { createContext, useContext, type ReactNode } from "react";

const RepoStarsContext = createContext<number | null>(null);

export function RepoStarsProvider({
  stars,
  children,
}: {
  stars: number | null;
  children: ReactNode;
}) {
  return (
    <RepoStarsContext.Provider value={stars}>
      {children}
    </RepoStarsContext.Provider>
  );
}

export function useRepoStars(): number | null {
  return useContext(RepoStarsContext);
}
