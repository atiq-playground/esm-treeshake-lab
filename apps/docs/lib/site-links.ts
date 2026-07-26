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

export const SITE_LINKS = {
  /** This project: used for fumadocs `githubUrl` (nav top-right). */
  repo: "https://github.com/atiq-playground/esm-treeshake-lab",
  portfolio: withUtm("https://atiqrahman.work/", "nav_portfolio"),
  githubProfile: withUtm("https://github.com/noonii", "nav_github_profile"),
  linkedin: withUtm("https://www.linkedin.com/in/atiq-r/", "nav_linkedin"),
  x: withUtm("https://x.com/afgmantu", "nav_x"),
} as const;
