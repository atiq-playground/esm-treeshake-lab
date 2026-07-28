import {
  loadQuickFacts,
  type EvidenceKind,
  type QuickFact,
  type QuickFactsSummary,
} from "@/lib/quick-facts";

/** Split `before → after` improvement headlines for red→green coloring. */
export function splitImprovementHeadline(
  headline: string,
): { before: string; after: string } | null {
  const idx = headline.indexOf("→");
  if (idx < 0) return null;
  const before = headline.slice(0, idx).trim();
  const after = headline.slice(idx + 1).trim();
  if (!before || !after) return null;
  return { before, after };
}

function evidenceClass(kind: EvidenceKind): string {
  if (kind === "measured") return "lab-fact-badge-measured";
  if (kind === "extrapolated") return "lab-fact-badge-extrapolated";
  return "lab-fact-badge-operator";
}

function headlineClass(emphasis: QuickFact["emphasis"]): string {
  if (emphasis === "singleton") return "lab-fact-headline-singleton";
  return "lab-fact-headline";
}

function FactHeadline({ fact }: { fact: QuickFact }) {
  const parts = splitImprovementHeadline(fact.headline);
  if (parts) {
    return (
      <p className="lab-fact-headline">
        <span className="lab-fact-before">{parts.before}</span>
        <span className="lab-fact-arrow" aria-hidden="true">
          {" "}
          →{" "}
        </span>
        <span className="lab-fact-after">{parts.after}</span>
      </p>
    );
  }

  return <p className={headlineClass(fact.emphasis)}>{fact.headline}</p>;
}

function FactExample({
  fact,
  compact,
}: {
  fact: QuickFact;
  compact: boolean;
}) {
  return (
    <div
      className="lab-fact-example"
      aria-label={`Example: ${fact.example.app}`}
    >
      <p className="lab-fact-example-app">{fact.example.app}</p>
      {!compact ? (
        <ul className="lab-fact-example-stack" aria-hidden="true">
          {fact.example.stack.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function FactRow({
  fact,
  compact,
}: {
  fact: QuickFact;
  compact: boolean;
}) {
  return (
    <li className="lab-fact" tabIndex={0}>
      <div className="lab-fact-measure">
        <div className="flex items-baseline justify-between gap-3">
          <p className="lab-label">{fact.label}</p>
          <span className={`lab-fact-badge ${evidenceClass(fact.evidence)}`}>
            {fact.badge}
          </span>
        </div>
        <FactHeadline fact={fact} />
        <ul className="lab-fact-tags" aria-label="Typical pipeline surfaces">
          {fact.pipelineTags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
        <p className="lab-fact-detail">{fact.detail}</p>
        <p className="lab-fact-expand">{fact.expand}</p>
      </div>
      <FactExample fact={fact} compact={compact} />
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
      className={
        compact
          ? "lab-facts lab-facts-compact not-prose"
          : "lab-facts not-prose"
      }
      aria-labelledby="quick-facts-heading"
    >
      <div
        className={
          compact
            ? "flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
            : "flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
        }
      >
        <h2 id="quick-facts-heading" className="lab-label">
          Quick facts
        </h2>
        <p className="lab-mono text-[length:var(--caption)] text-[color:var(--text-secondary)] sm:text-right">
          {compact
            ? "Hover for more · measured · extrapolated · operator feel"
            : "Hover for more · number left, example right"}
        </p>
      </div>

      <ul className="lab-facts-list">
        {data.facts.map((fact) => (
          <FactRow key={fact.id} fact={fact} compact={compact} />
        ))}
      </ul>

      <p className="lab-fact-caveat">{data.scopeNote}</p>
    </section>
  );
}
