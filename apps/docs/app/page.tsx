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
  const peak = comparison.largestSave;
  const isRange = min !== max;

  return (
    <HomeLayout {...baseOptions()}>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-6 py-16">
        <header className="flex flex-col gap-3">
          <p className="lab-label">GraphQL service bundle</p>
          <p
            className={
              isRange ? "lab-hero-number lab-hero-range" : "lab-hero-number"
            }
            aria-label={
              isRange
                ? `Saved between ${min} and ${max} percent`
                : `Saved ${min} percent`
            }
          >
            {isRange ? (
              <>
                <span className="lab-hero-range-min">{min}</span>
                <span className="lab-hero-range-sep" aria-hidden="true">
                  –
                </span>
                <span className="lab-hero-range-max">{max}</span>
                <span className="lab-hero-unit">%</span>
              </>
            ) : (
              <>
                {min}
                <span className="lab-hero-unit">%</span>
              </>
            )}
          </p>
          <p className="lab-mono text-sm text-[color:var(--text-primary)]">
            Biggest win: dropped {peak.sizeSavedPrimary} (
            {peak.plainTitle.toLowerCase()})
          </p>
          <p className="text-[length:var(--body)] text-[color:var(--text-secondary)]">
            Same schema, same resolvers you actually bind — different packaging.
          </p>
        </header>

        <div className="flex max-w-xl flex-col gap-3 text-[length:var(--body)] leading-relaxed text-[color:var(--text-primary)]">
          <p>
            Picture a GraphQL service whose resolver map{" "}
            <em>can</em> reach ~100 first-party domain packages — not “I
            installed 100 random npm libs,” but a real domain surface the schema
            might touch. One style side-effect-imports every package (plugin /
            singleton registry). The other imports only the resolvers you bind.
            Green bars are selective ESM. See{" "}
            <Link href="/docs/why">Why</Link>.
          </p>
          <p className="text-[length:var(--caption)] text-[color:var(--text-secondary)]">
            Stub packages only. We do <strong>not</strong> include{" "}
            <code className="lab-mono text-xs">graphql</code>, DataLoader, ORMs,
            auth SDKs, or other third-party deps — those can grow the bundle far
            more. The gap here is the first-party module graph alone.
          </p>
        </div>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
            <p className="lab-label sm:shrink-0">
              How heavy is the Worker / deploy artifact
            </p>
            <p className="lab-mono min-w-0 flex-1 text-[length:var(--caption)] text-[color:var(--text-secondary)] sm:text-right">
              Linear KB. Tiny greens get a stub so you can see them — label is
              the real size.
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
                  <span className="max-w-md text-[length:var(--caption)] text-[color:var(--text-secondary)]">
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
              Landing-shaped run (~3 resolvers/package):{" "}
              <code className="lab-mono text-sm">
                bun run lab:bench:wide -- --n=100 --used=300
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
