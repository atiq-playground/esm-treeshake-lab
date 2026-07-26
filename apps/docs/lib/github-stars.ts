const REPO_API =
  "https://api.github.com/repos/atiq-playground/esm-treeshake-lab";

/** Cached star count for the lab repo (revalidate hourly). */
export async function fetchRepoStars(): Promise<number | null> {
  try {
    const res = await fetch(REPO_API, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "esm-treeshake-lab-docs",
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { stargazers_count?: number };
    return typeof data.stargazers_count === "number"
      ? data.stargazers_count
      : null;
  } catch {
    return null;
  }
}

export function formatStars(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    const s = k >= 10 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, "");
    return `${s}k`;
  }
  return String(n);
}
