import Link from "next/link";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/lib/layout.shared";
import { loadBenchmarkLatest } from "@/lib/benchmark";
import { fetchRepoStars } from "@/lib/github-stars";
import { SITE_LINKS, withUtm } from "@/lib/site-links";

export default async function HomePage() {
  const report = loadBenchmarkLatest();
  const stars = await fetchRepoStars();
  const saved = `${report.benefit.bytesSavedPct}%`;

  return (
    <HomeLayout {...baseOptions({ stars })}>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-6 py-16">
        <header className="flex flex-col gap-3">
          <p className="lab-label">Saved</p>
          <p className="lab-hero-number">{saved}</p>
          <p className="lab-mono text-sm text-[color:var(--text-primary)]">
            {report.benefit.sizeSaved?.detail ??
              `${report.benefit.bytesSaved ?? 0} B`}
          </p>
          <p className="text-[length:var(--body)] text-[color:var(--text-secondary)]">
            Last run N={report.n} · {report.host} · {report.mode ?? "-"} ·{" "}
            {report.timestamp}
          </p>
        </header>

        <p className="max-w-xl text-[length:var(--body)] leading-relaxed text-[color:var(--text-primary)]">
          Singleton registry imports every plugin; ESM only pays for what you
          call: smaller cold starts when a GraphQL (or similar) façade could
          reach N packages but only wires some resolvers. See{" "}
          <Link href="/docs/why">Why</Link>.
        </p>

        <section className="grid gap-4 font-[family-name:var(--font-mono)] text-sm">
          <div className="flex flex-col gap-1 border-b border-[color:var(--border-visible)] py-2 sm:flex-row sm:justify-between sm:gap-4">
            <span className="lab-label">Singleton</span>
            <span className="lab-mono text-right">
              {report.arms.singleton.size?.detail ??
                `${report.arms.singleton.bytes} B`}
              <br />
              unused×{report.arms.singleton.markersUnusedRetained}
            </span>
          </div>
          <div className="flex flex-col gap-1 border-b border-[color:var(--border-visible)] py-2 sm:flex-row sm:justify-between sm:gap-4">
            <span className="lab-label">ESM</span>
            <span className="lab-mono text-right">
              {report.arms.esm.size?.detail ?? `${report.arms.esm.bytes} B`}
              <br />
              unused×{report.arms.esm.markersUnusedRetained}
            </span>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <span className="lab-label">N</span>
            <span className="lab-mono">{report.n}</span>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <p className="lab-label">How</p>
          <ol className="list-decimal space-y-2 pl-5 text-[length:var(--body)] text-[color:var(--text-primary)]">
            <li>Namespace-shaped exports + scale stubs (`@lab/*`)</li>
            <li>
              Home metrics = UC1: ESM calls <strong>1</strong> function
              (`used` on svc-0). Variants on{" "}
              <Link href="/docs/run">Run</Link>.
            </li>
            <li>
              <code className="lab-mono text-sm">bun run lab:bench:smoke</code>{" "}
              or{" "}
              <code className="lab-mono text-sm">
                bun run lab:bench -- --n=100
              </code>
            </li>
            <li>
              Need K of the surface?{" "}
              <code className="lab-mono text-sm">
                bun run lab:bench:partial -- --n=100 --used=8
              </code>
            </li>
            <li>
              Read{" "}
              <code className="lab-mono text-sm">
                docs/lab/benchmark-latest.md
              </code>
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

        <footer className="flex flex-col gap-2 border-t border-[color:var(--border-visible)] pt-8">
          <p className="lab-label">Atiq Rahman</p>
          <p className="lab-mono text-sm text-[color:var(--text-secondary)]">
            <a
              href={withUtm("https://atiqrahman.work/", "home_footer_portfolio")}
              target="_blank"
              rel="noopener noreferrer"
            >
              atiqrahman.work
            </a>
            {" · "}
            <a
              href={withUtm("https://github.com/noonii", "home_footer_github")}
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            {" · "}
            <a
              href={withUtm(
                "https://www.linkedin.com/in/atiq-r/",
                "home_footer_linkedin",
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>
            {" · "}
            <a
              href={withUtm("https://x.com/afgmantu", "home_footer_x")}
              target="_blank"
              rel="noopener noreferrer"
            >
              X
            </a>
            {" · "}
            <a
              href={SITE_LINKS.repo}
              target="_blank"
              rel="noopener noreferrer"
            >
              This repo
            </a>
          </p>
        </footer>
      </main>
    </HomeLayout>
  );
}
