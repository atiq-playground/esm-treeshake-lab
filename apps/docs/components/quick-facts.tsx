import {
  loadQuickFacts,
  type EvidenceKind,
  type QuickFact,
  type QuickFactsSummary,
} from "@/lib/quick-facts";

function evidenceClass(kind: EvidenceKind): string {
  if (kind === "measured") return "lab-fact-badge-measured";
  if (kind === "extrapolated") return "lab-fact-badge-extrapolated";
  return "lab-fact-badge-operator";
}

function headlineClass(emphasis: QuickFact["emphasis"]): string {
  if (emphasis === "esm") return "lab-fact-headline-esm";
  if (emphasis === "singleton") return "lab-fact-headline-singleton";
  return "lab-fact-headline";
}

function FactCard({ fact }: { fact: QuickFact }) {
  return (
    <li className="lab-fact">
      <div className="flex items-baseline justify-between gap-3">
        <p className="lab-label">{fact.label}</p>
        <span className={`lab-fact-badge ${evidenceClass(fact.evidence)}`}>
          {fact.badge}
        </span>
      </div>
      <p className={headlineClass(fact.emphasis)}>{fact.headline}</p>
      <p className="text-[length:var(--caption)] leading-snug text-[color:var(--text-secondary)]">
        {fact.detail}
      </p>
      {fact.caveat ? (
        <p className="lab-fact-caveat">{fact.caveat}</p>
      ) : null}
    </li>
  );
}

type Props = {
  summary?: QuickFactsSummary;
  /** Compact for docs pages */
  compact?: boolean;
};

export function QuickFacts({ summary, compact = false }: Props) {
  const data = summary ?? loadQuickFacts();

  return (
    <section
      className={compact ? "lab-facts lab-facts-compact" : "lab-facts"}
      aria-labelledby="quick-facts-heading"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        <h2 id="quick-facts-heading" className="lab-label">
          Quick facts
        </h2>
        <p className="lab-mono text-[length:var(--caption)] text-[color:var(--text-secondary)] sm:text-right">
          What teams lose with a registry — measured, then scaled to N=500–1000+
        </p>
      </div>

      <ul className="lab-facts-grid">
        {data.facts.map((fact) => (
          <FactCard key={fact.id} fact={fact} />
        ))}
      </ul>

      <p className="text-[length:var(--caption)] leading-relaxed text-[color:var(--text-secondary)]">
        {data.scopeNote} Badge legend:{" "}
        <span className="lab-fact-badge lab-fact-badge-measured">Measured</span>{" "}
        lab esbuild ·{" "}
        <span className="lab-fact-badge lab-fact-badge-extrapolated">
          Extrapolated
        </span>{" "}
        linear in N ·{" "}
        <span className="lab-fact-badge lab-fact-badge-operator">
          Operator feel
        </span>{" "}
        not a lab host metric.
      </p>
    </section>
  );
}
