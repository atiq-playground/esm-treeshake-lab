/** External profiles + this lab’s repo. Portfolio always carries UTMs. */

const UTM = {
  source: "esm-treeshake-lab",
  medium: "referral",
  campaign: "docs",
} as const;

export function withUtm(base: string, content: string): string {
  const url = new URL(base);
  url.searchParams.set("utm_source", UTM.source);
  url.searchParams.set("utm_medium", UTM.medium);
  url.searchParams.set("utm_campaign", UTM.campaign);
  url.searchParams.set("utm_content", content);
  return url.toString();
}

/** Bare URLs (README / plain markdown). */
export const GITHUB = {
  repo: "https://github.com/atiq-playground/esm-treeshake-lab",
  profile: "https://github.com/noonii",
} as const;

export const SITE_LINKS = {
  /** This project: used for fumadocs `githubUrl` (nav top-right). */
  repo: GITHUB.repo,
  /** Repo page: Star button is top-right once signed in. */
  star: withUtm(GITHUB.repo, "cta_star"),
  /** Author profile: Follow button. */
  follow: withUtm(GITHUB.profile, "cta_follow"),
  portfolio: withUtm("https://atiqrahman.work/", "nav_portfolio"),
  githubProfile: withUtm(GITHUB.profile, "nav_github_profile"),
  linkedin: withUtm("https://www.linkedin.com/in/atiq-r/", "nav_linkedin"),
  x: withUtm("https://x.com/afgmantu", "nav_x"),
} as const;
