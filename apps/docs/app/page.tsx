import Link from "next/link";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { GitHubIcon, LinkedInIcon, XIcon } from "@/components/brand-icons";
import { PackagingCodeExampleSection } from "@/components/packaging-code-example-section";
import { PackagingMetaphor } from "@/components/packaging-metaphor";
import { SupportCta } from "@/components/support-cta";
import { QuickFacts } from "@/components/quick-facts";
import { UseCaseComparisonChartLazy } from "@/components/use-case-comparison-chart-lazy";
import { baseOptions } from "@/lib/layout.shared";
import { loadUseCaseComparison } from "@/lib/benchmark";
import { loadQuickFacts } from "@/lib/quick-facts";
import { SITE_LINKS, withUtm } from "@/lib/site-links";

export default async function HomePage() {
  const comparison = loadUseCaseComparison();
  const quickFacts = loadQuickFacts();
  const peak = comparison.largestSave;
  const peakFactor = peak.singletonVsEsmFactor ?? 1;

  return (
    <HomeLayout {...baseOptions()}>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-14 px-6 py-16">
        <header className="flex flex-col gap-4">
          <h1 className="lab-brand">ESM TREE-SHAKE LAB</h1>
          <p
            className="lab-hero-number lab-hero-sizes"
            aria-label={`${peak.singletonPrimary} to ${peak.esmPrimary}`}
          >
            <span className="lab-hero-from">{peak.singletonPrimary}</span>
            <span className="lab-hero-arrow" aria-hidden="true">
              →
            </span>
            <span className="lab-hero-to">{peak.esmPrimary}</span>
          </p>
          <p className="text-[length:var(--body)] text-[color:var(--text-primary)]">
            Singleton registry vs ESM tree-shake
          </p>
        </header>

        <section className="flex flex-col gap-8">
          <PackagingMetaphor
            singletonSize={peak.singletonPrimary}
            esmSize={peak.esmPrimary}
            factor={peakFactor}
            caseTitle={peak.plainTitle}
          />
        </section>

        <PackagingCodeExampleSection />

        <section className="flex flex-col gap-3">
          <p className="lab-label">Worker / deploy artifact</p>
          <p className="text-[length:var(--body)] text-[color:var(--text-secondary)]">
            Singleton vs ESM size · four surfaces
          </p>
          <UseCaseComparisonChartLazy rows={comparison.rows} />
        </section>

        <QuickFacts summary={quickFacts} />

        <section className="flex flex-col gap-3">
          <p className="lab-label">Try it</p>
          <p className="lab-mono text-sm text-[color:var(--text-primary)]">
            bun run lab:bench:wide -- --n=100 --used=300
          </p>
          <p className="lab-label">
            <Link href="/docs/why">Why</Link>
            {" · "}
            <Link href="/docs/run">Run</Link>
            {" · "}
            <Link href="/docs/research">Research</Link>
          </p>
        </section>

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
