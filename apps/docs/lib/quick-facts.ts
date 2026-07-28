import type { BenchmarkReport } from "./benchmark";
import {
  loadAllBenchmarkReports,
  loadExtendedBenchmarkReports,
} from "./benchmark";
import { byteParts } from "./format-bytes";
import {
  formatProjectedBytes,
  SCALE_PROJECTION_ASSUMPTIONS,
  type EvidenceKind,
} from "./scale-projection";
import scaleSweep from "../../../docs/research/scale-bench-sweep.json";

export type { EvidenceKind };

export type QuickFactId =
  | "deploy-payload"
  | "n1000-singleton"
  | "org-scale"
  | "build-cpu"
  | "third-party"
  | "many-consumers"
  | "cold-start";

/** Typical pipeline tools / surfaces this fact maps to (not measured hosts). */
export type PipelineTag =
  | "Workers"
  | "Docker"
  | "CI"
  | "egress"
  | "esbuild"
  | "npm"
  | "Node"
  | "memory"
  | "monorepo";

/** Illustrative “who hurts?” vignette — not a measured host. */
export type QuickFactExample = {
  app: string;
  /** Runtime → bundler → ship, 3–5 short lines */
  stack: readonly string[];
};

export type QuickFact = {
  id: QuickFactId;
  /** Uppercase strip label */
  label: string;
  /** Punchy primary line (sizes / multipliers) */
  headline: string;
  /** Always-visible short supporting line */
  detail: string;
  /** Extra numbers / context revealed on hover or focus */
  expand: string;
  evidence: EvidenceKind;
  /** Short badge text */
  badge: string;
  /** Pipeline associations for operators */
  pipelineTags: readonly PipelineTag[];
  /** Concrete app + stack that answers “who hurts?” */
  example: QuickFactExample;
  /** Optional second line — reserved for rare warnings */
  caveat?: string;
  emphasis: "singleton" | "esm" | "neutral";
};

const PIPELINE_TAGS: Record<QuickFactId, readonly PipelineTag[]> = {
  "deploy-payload": ["Workers", "Docker", "egress"],
  "n1000-singleton": ["esbuild", "Workers", "Docker"],
  "org-scale": ["Docker", "egress", "Workers"],
  "build-cpu": ["CI", "esbuild"],
  "third-party": ["npm", "Docker", "esbuild"],
  "many-consumers": ["monorepo", "CI", "Docker"],
  "cold-start": ["Node", "Workers", "memory"],
};

/** Illustrative associations — honesty stays in scopeNote / expand. */
const EXAMPLES: Record<QuickFactId, QuickFactExample> = {
  "deploy-payload": {
    app: "Edge GraphQL Worker",
    stack: ["Workers", "wrangler", "esbuild", "egress"],
  },
  "n1000-singleton": {
    app: "Plugin platform @ 1k packages",
    stack: ["esbuild", "Workers", "fat registry"],
  },
  "org-scale": {
    app: "Org monorepo @ 500–1000 pkgs",
    stack: ["Docker", "deploy", "egress"],
  },
  "build-cpu": {
    app: "Monorepo CI cache miss",
    stack: ["GitHub Actions", "Bun", "esbuild"],
  },
  "third-party": {
    app: "BFF with unused SDK ballast",
    stack: ["npm", "Docker", "esbuild"],
  },
  "many-consumers": {
    app: "100 identical Worker apps",
    stack: ["monorepo", "CI", "Docker"],
  },
  "cold-start": {
    app: "Node service cold import",
    stack: ["Node", "Workers", "memory"],
  },
};

export type QuickFactsSummary = {
  facts: QuickFact[];
  measuredN: number;
  assumptions: readonly { id: string; summary: string }[];
  /** Footnote for the whole strip */
  scopeNote: string;
};

export type QuickFactsExtended = {
  thirdparty?: BenchmarkReport;
  thirdpartyReal?: BenchmarkReport;
  fleet?: BenchmarkReport;
  coldstart?: BenchmarkReport;
};

type SweepRow = {
  case: string;
  n: number;
  callSites: number;
  singletonBytes: number;
  esmBytes: number;
  singletonBuildMs: number;
  esmBuildMs: number;
};

function sweepRow(caseId: string, n: number): SweepRow {
  const row = (scaleSweep.rows as SweepRow[]).find(
    (r) => r.case === caseId && r.n === n,
  );
  if (!row) {
    throw new Error(`Missing scale sweep row case=${caseId} n=${n}`);
  }
  return row;
}

function pctLabel(pct: number | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "";
  return `${Math.round(pct)}%`;
}

function factorLabel(factor: number | undefined): string {
  if (factor == null || !Number.isFinite(factor)) return "";
  return `${Math.round(factor)}×`;
}

function thirdPartyFact(
  stub: BenchmarkReport,
  real?: BenchmarkReport,
): QuickFact {
  const singleton =
    stub.arms.singleton.size?.primary ??
    byteParts(stub.arms.singleton.bytes).primary;
  const esm =
    stub.arms.esm.size?.primary ?? byteParts(stub.arms.esm.bytes).primary;
  const stubPct = pctLabel(stub.benefit.bytesSavedPct);
  const realPct = real != null ? pctLabel(real.benefit.bytesSavedPct) : null;
  const count = stub.thirdParty?.count ?? "?";
  const ballast =
    stub.thirdParty != null
      ? byteParts(stub.thirdParty.bytesPerPackage).primary
      : "?";

  const realExpand =
    real != null
      ? ` Real npm @ N=${real.n}: ${real.arms.singleton.size?.primary ?? byteParts(real.arms.singleton.bytes).primary} → ${real.arms.esm.size?.primary ?? byteParts(real.arms.esm.bytes).primary} (${realPct}).`
      : "";

  return {
    id: "third-party",
    label: "Unused SDKs",
    headline: `${singleton} → ${esm}`,
    detail: realPct
      ? `${stubPct} smaller; real npm ~${realPct.replace("%", "")}%`
      : `${stubPct} smaller on unused extras`,
    expand: `Stub 3p @ N=${stub.n} · ${count}×${ballast}: singleton keeps unused extras; ESM pays shared core only.${realExpand}`,
    evidence: "measured",
    badge: "Measured",
    pipelineTags: PIPELINE_TAGS["third-party"],
    example: EXAMPLES["third-party"],
    emphasis: "esm",
  };
}

function manyConsumersFact(
  wide: BenchmarkReport,
  fleet?: BenchmarkReport,
): QuickFact {
  if (fleet?.fleet) {
    const totals = fleet.fleet;
    const singleton =
      totals.singletonSize?.primary ?? byteParts(totals.singletonBytes).primary;
    const esm = totals.esmSize?.primary ?? byteParts(totals.esmBytes).primary;
    const m = totals.consumers;
    const shared = totals.shared;
    const sharedExpand =
      shared != null
        ? ` Multi-entry shared: ${shared.singletonSize?.primary ?? byteParts(shared.singletonBytes).primary} → ${shared.esmSize?.primary ?? byteParts(shared.esmBytes).primary}` +
          (totals.sharingSavingsPct != null
            ? ` (${pctLabel(totals.sharingSavingsPct)} less singleton than naive ×M).`
            : ".")
        : "";

    return {
      id: "many-consumers",
      label: "Many apps",
      headline: `${singleton} → ${esm}`,
      detail: `${m} apps: pay once, not ${m}×`,
      expand: `Naive fleet @ N=${fleet.n} × M=${m}: each identical app pays the registry again · ${pctLabel(totals.bytesSavedPct)} smaller across the fleet.${sharedExpand}`,
      evidence: "measured",
      badge: "Measured",
      pipelineTags: PIPELINE_TAGS["many-consumers"],
      example: EXAMPLES["many-consumers"],
      emphasis: "esm",
    };
  }

  const unit =
    wide.arms.singleton.size?.primary ?? byteParts(wide.arms.singleton.bytes).primary;

  return {
    id: "many-consumers",
    label: "Many apps",
    headline: "× apps",
    detail: `Each app pays the full ${unit} again`,
    expand:
      "Side-effect import of the registry repeats the full graph per monorepo app. Multiplier is packaging topology, not a separate lab host.",
    evidence: "operator",
    badge: "Operator feel",
    pipelineTags: PIPELINE_TAGS["many-consumers"],
    example: EXAMPLES["many-consumers"],
    emphasis: "neutral",
  };
}

function coldStartFact(report?: BenchmarkReport): QuickFact {
  if (report?.arms.singleton.importMs != null && report.arms.esm.importMs != null) {
    const s = report.arms.singleton;
    const e = report.arms.esm;
    const rssSaved =
      report.benefit.rssSizeSaved?.primary ??
      (report.benefit.rssBytesSaved != null
        ? byteParts(report.benefit.rssBytesSaved).primary
        : null);
    const importSaved = report.benefit.importMsSavedPct;
    const smokeOrTinyRss =
      report.mode === "smoke" ||
      report.n <= 3 ||
      (report.benefit.rssBytesSavedPct != null &&
        report.benefit.rssBytesSavedPct < 1);

    const detail = smokeOrTinyRss
      ? "Smoke N understates RSS — use research N=50"
      : [
          importSaved != null ? `${pctLabel(importSaved)} faster` : null,
          rssSaved != null && report.benefit.rssBytesSaved
            ? `${rssSaved} less RSS`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");

    const expand = smokeOrTinyRss
      ? `Node cold import @ N=${report.n}: ${s.importMs} ms → ${e.importMs} ms` +
        (importSaved != null ? ` · ${pctLabel(importSaved)} faster` : "") +
        ". Absolute RSS ≈ Node baseline (~45 MB), so smoke looks flat; published latest uses N=50."
      : `Node cold import of an already-bundled .mjs @ N=${report.n} — not Workers isolate boot.` +
        (rssSaved != null && report.benefit.rssBytesSavedPct != null
          ? ` RSS Δ ${rssSaved} (${pctLabel(report.benefit.rssBytesSavedPct)}); absolute RSS includes ~45 MB Node baseline.`
          : " Use import ms + RSS Δ, not absolute RSS.");

    return {
      id: "cold-start",
      label: "Cold import",
      headline: `${s.importMs} ms → ${e.importMs} ms`,
      detail: detail || "Node cold import wall time",
      expand,
      evidence: "measured",
      badge: "Measured",
      pipelineTags: PIPELINE_TAGS["cold-start"],
      example: EXAMPLES["cold-start"],
      emphasis: "esm",
    };
  }

  return {
    id: "cold-start",
    label: "Cold import",
    headline: "Parse what you ship",
    detail: "Run coldstart bench for import ms + RSS",
    expand:
      "Worker/isolate cold start and memory track retained JS. Workers isolate boot remains unmeasured in this lab.",
    evidence: "operator",
    badge: "Operator feel",
    pipelineTags: PIPELINE_TAGS["cold-start"],
    example: EXAMPLES["cold-start"],
    emphasis: "neutral",
  };
}

/**
 * Build scannable QUICK FACTS from landing benches + N-ladder sweep.
 * Headline + short detail always show; expand adds numbers on hover/focus.
 * Method lives in scopeNote — not per-card caveats.
 */
export function toQuickFacts(
  reports: Record<"baseline" | "wide" | "cycles" | "partial", BenchmarkReport>,
  extended: QuickFactsExtended = {},
): QuickFactsSummary {
  const wide = reports.wide;
  const measuredN = wide.n;
  const singleton = wide.arms.singleton;
  const esm = wide.arms.esm;
  const factor = wide.benefit.singletonVsEsmFactor;
  const savedPct = wide.benefit.bytesSavedPct;

  const wide1000 = sweepRow("wide", 1000);
  const at500 = formatProjectedBytes({
    measuredBytes: singleton.bytes,
    measuredN,
    targetN: 500,
  });
  const at1000Landing = formatProjectedBytes({
    measuredBytes: singleton.bytes,
    measuredN,
    targetN: 1000,
  });
  const singletonPrimary =
    singleton.size?.primary ?? byteParts(singleton.bytes).primary;
  const esmPrimary = esm.size?.primary ?? byteParts(esm.bytes).primary;

  const facts: QuickFact[] = [
    {
      id: "deploy-payload",
      label: "Deploy size",
      headline: `${singletonPrimary} → ${esmPrimary}`,
      detail: `${pctLabel(savedPct)} smaller · ${factorLabel(factor)} less to deploy`,
      expand: `Fat modules @ N=${measuredN}: singleton registry vs selective ESM · landing-shaped K (~3 resolvers/pkg). Drives Worker upload, Docker COPY, and egress.`,
      evidence: "measured",
      badge: "Measured",
      pipelineTags: PIPELINE_TAGS["deploy-payload"],
      example: EXAMPLES["deploy-payload"],
      emphasis: "esm",
    },
    {
      id: "n1000-singleton",
      label: "At 1000 packages",
      headline: byteParts(wide1000.singletonBytes).primary,
      detail: `ESM stays ${byteParts(wide1000.esmBytes).primary} if you import one package`,
      expand: `Wide sweep singleton @ N=1000 (K=${wide1000.callSites}). Singleton size still tracks N; ESM stays flat when the entry imports one package.`,
      evidence: "measured",
      badge: "Measured",
      pipelineTags: PIPELINE_TAGS["n1000-singleton"],
      example: EXAMPLES["n1000-singleton"],
      emphasis: "singleton",
    },
    {
      id: "org-scale",
      label: "Org scale",
      headline: `${at500.primary}–${at1000Landing.primary}`,
      detail: "Where many orgs actually sit",
      expand: `Projected singleton deploy from fat landing @ N=${measuredN} → N=500–1000 (linear in N · same fns/package · first-party stubs).`,
      evidence: "extrapolated",
      badge: "Extrapolated",
      pipelineTags: PIPELINE_TAGS["org-scale"],
      example: EXAMPLES["org-scale"],
      emphasis: "singleton",
    },
    {
      id: "build-cpu",
      label: "Rebuild time",
      headline: `${wide1000.singletonBuildMs} ms → ${wide1000.esmBuildMs} ms`,
      detail: "Cache-miss rebuild stays near-flat",
      expand: `esbuild wall time, wide @ N=1000. Cache misses re-parse the full registry graph — order-of-magnitude on laptop, not a CI SLO.`,
      evidence: "measured",
      badge: "Measured",
      pipelineTags: PIPELINE_TAGS["build-cpu"],
      example: EXAMPLES["build-cpu"],
      emphasis: "esm",
    },
  ];

  if (extended.thirdparty) {
    facts.push(thirdPartyFact(extended.thirdparty, extended.thirdpartyReal));
  }

  facts.push(
    manyConsumersFact(wide, extended.fleet),
    coldStartFact(extended.coldstart),
  );

  const hasExtended = Boolean(
    extended.thirdparty ||
      extended.thirdpartyReal ||
      extended.fleet ||
      extended.coldstart,
  );

  return {
    facts,
    measuredN,
    assumptions: [
      SCALE_PROJECTION_ASSUMPTIONS.singletonBytesLinearInN,
      SCALE_PROJECTION_ASSUMPTIONS.firstPartyGraphOnly,
      SCALE_PROJECTION_ASSUMPTIONS.thinCallSitesNotLandingShaped,
    ],
    scopeNote: hasExtended
      ? "Stub first-party + sibling benches (3p, fleet, coldstart). Method → Research."
      : "Stub first-party graphs only. Same K call sites. Method → Research.",
  };
}

export function loadQuickFacts(): QuickFactsSummary {
  return toQuickFacts(
    loadAllBenchmarkReports(),
    loadExtendedBenchmarkReports(),
  );
}
