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

export type QuickFact = {
  id: QuickFactId;
  /** Uppercase strip label */
  label: string;
  /** Punchy primary line (sizes / multipliers) */
  headline: string;
  /** One scannable supporting line */
  detail: string;
  evidence: EvidenceKind;
  /** Short badge text */
  badge: string;
  /** Optional second line for assumptions / caveats */
  caveat?: string;
  emphasis: "singleton" | "esm" | "neutral";
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

function factorLabel(factor: number | undefined): string {
  if (factor == null || !Number.isFinite(factor)) return "";
  const rounded = factor >= 10 ? Math.round(factor) : Number(factor.toFixed(1));
  return `${rounded}×`;
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
  const count = stub.thirdParty?.count ?? "?";
  const ballast =
    stub.thirdParty != null
      ? byteParts(stub.thirdParty.bytesPerPackage).primary
      : "?";

  const realLine =
    real != null
      ? ` Real npm (graphql + unused SDK extras) @ N=${real.n}: ${real.arms.singleton.size?.primary ?? byteParts(real.arms.singleton.bytes).primary} → ${real.arms.esm.size?.primary ?? byteParts(real.arms.esm.bytes).primary} (${real.benefit.bytesSavedPct}%).`
      : "";

  return {
    id: "third-party",
    label: "Unused SDK ballast",
    headline: `${singleton} → ${esm}`,
    detail: `Stub 3p @ N=${stub.n} · ${count}×${ballast}: singleton keeps unused extras; ESM pays shared core only · ${stub.benefit.bytesSavedPct}% smaller.${realLine}`,
    evidence: "measured",
    badge: "Measured",
    caveat: real
      ? "Stub path = reproducible byte floors. Real path = pinned graphql/dataloader/graphql-tag/uuid (lockfile)."
      : "Generated @lab/3p-* stubs with fixed ballast — pass --3p=real for pinned npm.",
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
    const shared = totals.shared;
    const sharedLine =
      shared != null
        ? ` Multi-entry shared: ${shared.singletonSize?.primary ?? byteParts(shared.singletonBytes).primary} → ${shared.esmSize?.primary ?? byteParts(shared.esmBytes).primary}` +
          (totals.sharingSavingsPct != null
            ? ` (${totals.sharingSavingsPct}% less singleton than naive ×M).`
            : ".")
        : "";

    return {
      id: "many-consumers",
      label: "Many consumers",
      headline: `${singleton} → ${esm}`,
      detail: `Naive fleet @ N=${fleet.n} × M=${totals.consumers}: each identical app pays the registry again · ${totals.bytesSavedPct}% smaller across the fleet.${sharedLine}`,
      evidence: "measured",
      badge: "Measured",
      caveat:
        "Naive = per-consumer × M (separate deploys). Shared = one esbuild multi-entry with code-splitting.",
      emphasis: "esm",
    };
  }

  return {
    id: "many-consumers",
    label: "Many consumers",
    headline: "× apps",
    detail: `Each monorepo app that side-effect-imports the registry ships the full graph again. 5 consumers ≈ 5× ${wide.arms.singleton.size?.primary ?? byteParts(wide.arms.singleton.bytes).primary} into 5 artifacts.`,
    evidence: "operator",
    badge: "Operator feel",
    caveat: "Multiplier is packaging topology, not a separate lab host.",
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
    return {
      id: "cold-start",
      label: "Cold start / memory",
      headline: `${s.importMs} ms → ${e.importMs} ms`,
      detail: `Node cold import @ N=${report.n}: singleton vs ESM wall time` +
        (importSaved != null ? ` · ${importSaved}% faster` : "") +
        (rssSaved != null && report.benefit.rssBytesSaved
          ? ` · RSS Δ ${rssSaved} (${report.benefit.rssBytesSavedPct}%)`
          : "") +
        ".",
      evidence: "measured",
      badge: "Measured",
      caveat: smokeOrTinyRss
        ? "Times one already-bundled .mjs per arm (esbuild done before the clock) — not multi-module load or Workers isolate boot. Absolute RSS ≈ Node baseline (~45 MB), so smoke N looks almost flat; prefer import ms at --n=50 or deploy-byte benches for the real gap."
        : "Node cold import of an already-bundled .mjs — not Workers isolate boot. Absolute RSS includes ~45 MB Node baseline; use import ms + RSS Δ, not absolute RSS.",
      emphasis: "esm",
    };
  }

  return {
    id: "cold-start",
    label: "Cold start / memory",
    headline: "Parse what you ship",
    detail:
      "Worker/isolate cold start and memory track retained JS. Run lab:bench:coldstart for Node import ms + RSS.",
    evidence: "operator",
    badge: "Operator feel",
    caveat: "Workers isolate boot remains unmeasured in this lab.",
    emphasis: "neutral",
  };
}

/**
 * Build scannable QUICK FACTS from landing benches + N-ladder sweep.
 * Separates measured lab numbers from linear-N extrapolations and operator feels.
 * Optional sibling reports (thirdparty / fleet / coldstart) promote measured cards.
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

  const facts: QuickFact[] = [
    {
      id: "deploy-payload",
      label: "Deploy / isolate",
      headline: `${singleton.size?.primary ?? byteParts(singleton.bytes).primary} → ${esm.size?.primary ?? byteParts(esm.bytes).primary}`,
      detail: `Fat modules @ N=${measuredN}: singleton registry vs selective ESM · ${savedPct}% smaller · ${factorLabel(factor)} size`,
      evidence: "measured",
      badge: "Measured",
      caveat: "Landing-shaped K (~3 resolvers/pkg). UC1–UC4 first-party stubs.",
      emphasis: "esm",
    },
    {
      id: "n1000-singleton",
      label: "N=1000 registry",
      headline: byteParts(wide1000.singletonBytes).primary,
      detail: `Wide sweep singleton @ N=1000 (K=${wide1000.callSites}). ESM stays ${byteParts(wide1000.esmBytes).primary} when the entry imports one package.`,
      evidence: "measured",
      badge: "Measured",
      caveat: "Sweep K=1 (not landing’s ~3/pkg). Singleton size still tracks N.",
      emphasis: "singleton",
    },
    {
      id: "org-scale",
      label: "Orgs at 500–1000+",
      headline: `${at500.primary}–${at1000Landing.primary}`,
      detail: `Projected singleton deploy from fat landing @ N=${measuredN}. Many orgs live here — not stuck at N=100.`,
      evidence: "extrapolated",
      badge: "Extrapolated",
      caveat: "Linear in N · same fns/package · first-party stubs only.",
      emphasis: "singleton",
    },
    {
      id: "build-cpu",
      label: "CI & local rebuild",
      headline: `${wide1000.singletonBuildMs} ms → ${wide1000.esmBuildMs} ms`,
      detail: `esbuild wall time, wide @ N=1000. Cache misses and local reloads re-parse the full registry graph — ESM stays near-flat.`,
      evidence: "measured",
      badge: "Measured",
      caveat:
        "Laptop WSL2 / Bun — order-of-magnitude, not a CI SLO. Install times are not a story here (stubs are resolution-only).",
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
      ? "UC1–UC4: stub first-party graphs. Sibling benches add stub/real 3p ballast, fleet ×M vs multi-entry shared, and Node cold-start RSS. Numbers compare packaging for the same call-site count K."
      : "Stub first-party graphs only — no graphql, DataLoader, ORMs, or auth SDKs. Numbers compare packaging for the same call-site count K.",
  };
}

export function loadQuickFacts(): QuickFactsSummary {
  return toQuickFacts(
    loadAllBenchmarkReports(),
    loadExtendedBenchmarkReports(),
  );
}
