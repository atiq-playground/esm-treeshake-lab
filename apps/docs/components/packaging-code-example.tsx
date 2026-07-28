"use client";

import { useId, useState } from "react";
import type { HighlightedPackagingExample } from "@/lib/highlight-packaging-examples";
import type { PackagingLangId } from "@/lib/packaging-examples";

type Props = {
  examples: HighlightedPackagingExample[];
};

export function PackagingCodeExample({ examples }: Props) {
  const baseId = useId();
  const [langId, setLangId] = useState<PackagingLangId>(
    examples[0]?.id ?? "typescript",
  );
  const active = examples.find((ex) => ex.id === langId) ?? examples[0];

  if (!active) return null;

  return (
    <section className="lab-code-example" aria-labelledby={`${baseId}-heading`}>
      <p className="lab-label">The pattern</p>
      <h2 id={`${baseId}-heading`} className="lab-code-example-title">
        Same call shape. Different bill.
      </h2>
      <p className="lab-code-example-lead">
        Keep <span className="lab-mono">Users.getUser</span> — drop the live
        bag. Named exports + namespace import (or top-level functions) let unused
        surface shake out.
      </p>

      <div className="lab-code-tabs" role="tablist" aria-label="Language">
        {examples.map((ex) => {
          const selected = ex.id === active.id;
          return (
            <button
              key={ex.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${ex.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              className={
                selected ? "lab-code-tab lab-code-tab-active" : "lab-code-tab"
              }
              onClick={() => setLangId(ex.id)}
            >
              {ex.label}
            </button>
          );
        })}
      </div>

      <p className="lab-code-example-why">{active.why}</p>

      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${active.id}`}
        className="lab-code-panels"
      >
        <CodePanel tone="bad" label="Bad" html={active.badHtml} />
        <CodePanel tone="good" label="Good" html={active.goodHtml} />
      </div>
    </section>
  );
}

function CodePanel({
  tone,
  label,
  html,
}: {
  tone: "bad" | "good";
  label: string;
  html: string;
}) {
  return (
    <div className={`lab-code-panel lab-code-panel-${tone}`}>
      <p className="lab-code-panel-label">
        <span aria-hidden="true">{tone === "bad" ? "✗" : "✓"}</span> {label}
      </p>
      <div
        className="lab-code-pre"
        // Static lab snippets + Shiki — not user HTML.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
