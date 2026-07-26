import Link from "next/link";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { GitHubIcon, LinkedInIcon, XIcon } from "@/components/brand-icons";
import { SupportCta } from "@/components/support-cta";
import { UseCaseComparisonChart } from "@/components/use-case-comparison-chart";
import { baseOptions } from "@/lib/layout.shared";
import { loadUseCaseComparison } from "@/lib/benchmark";
import { SITE_LINKS, withUtm } from "@/lib/site-links";

export default async function HomePage() {
  const comparison = loadUseCaseComparison();
  const { min, max } = comparison.savedPctRange;
  const savedRange = min === max ? `${min}%` : `${min}–${max}%`;
  const peak = comparison.largestSave;

  return (
    <HomeLayout {...baseOptions()}>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-6 py-16">
        <header className="flex flex-col gap-3">
          <p className="lab-label">How much smaller</p>
          <p className="lab-hero-number">{savedRange}</p>
          <p className="lab-mono text-sm text-[color:var(--text-primary)]">
            Biggest win: dropped {peak.sizeSavedPrimary} (
            {peak.plainTitle.toLowerCase()})
          </p>
          <p className="text-[length:var(--body)] text-[color:var(--text-secondary)]">
            Four real tests. Same story each time: less junk shipped.
          </p>
        </header>

        <p className="max-w-xl text-[length:var(--body)] leading-relaxed text-[color:var(--text-primary)]">
          Imagine a backpack full of tools. One style always packs the whole
          bag — even tools you never touch. The other packs only the tool you
          ask for. The green bars are the light bag. See{" "}
          <Link href="/docs/why">Why</Link>.
        </p>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <p className="lab-label">How heavy is the download</p>
            <p className="lab-mono text-[length:var(--caption)] text-[color:var(--text-secondary)]">
              Taller bar = bigger file
            </p>
          </div>
          <UseCaseComparisonChart rows={comparison.rows} />
          <ul className="grid gap-4">
            {comparison.rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-1 border-b border-[color:var(--border-visible)] py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
              >
                <div className="flex flex-col gap-1">
                  <span className="lab-label">{row.plainTitle}</span>
                  <span className="max-w-xs text-[length:var(--caption)] text-[color:var(--text-secondary)]">
                    {row.plainBlurb}
                  </span>
                </div>
                <span className="lab-mono text-sm text-[color:var(--text-primary)] sm:text-right">
                  {row.singletonPrimary} → {row.esmPrimary}
                  <br />
                  <span className="text-[color:var(--text-secondary)]">
                    {row.bytesSavedPct}% smaller · {row.plainMeta}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-4">
          <p className="lab-label">Try it yourself</p>
          <ol className="list-decimal space-y-2 pl-5 text-[length:var(--body)] text-[color:var(--text-primary)]">
            <li>Clone the repo.</li>
            <li>
              Quick check:{" "}
              <code className="lab-mono text-sm">bun run lab:bench:smoke</code>
            </li>
            <li>
              Bigger run:{" "}
              <code className="lab-mono text-sm">
                bun run lab:bench -- --n=100
              </code>
            </li>
            <li>
              More stories on <Link href="/docs/run">Run</Link>. Deep dive on{" "}
              <Link href="/docs/why">Why</Link>.
            </li>
          </ol>
        </section>

        <p className="lab-label">
          <Link href="/docs/why">Why</Link>
          {" · "}
          <Link href="/docs/run">Run</Link>
          {" · "}
          <Link href="/docs/research">Research</Link>
        </p>

        <SupportCta />

        <footer className="flex flex-col gap-3 border-t border-[color:var(--border-visible)] pt-8">
          <p className="lab-label">Atiq Rahman</p>
          <p className="flex flex-wrap items-center gap-3 text-[color:var(--text-secondary)]">
            <a
              href={withUtm("https://atiqrahman.work/", "home_footer_portfolio")}
              target="_blank"
              rel="noopener noreferrer"
              className="lab-mono text-sm text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
            >
              Portfolio
            </a>
            <a
              href={withUtm("https://github.com/noonii", "home_footer_github")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
              aria-label="GitHub"
            >
              <GitHubIcon />
            </a>
            <a
              href={withUtm(
                "https://www.linkedin.com/in/atiq-r/",
                "home_footer_linkedin",
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
              aria-label="LinkedIn"
            >
              <LinkedInIcon />
            </a>
            <a
              href={withUtm("https://x.com/afgmantu", "home_footer_x")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
              aria-label="X"
            >
              <XIcon />
            </a>
            <a
              href={SITE_LINKS.repo}
              target="_blank"
              rel="noopener noreferrer"
              className="lab-mono text-sm text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
            >
              This repo
            </a>
          </p>
        </footer>
      </main>
    </HomeLayout>
  );
}
