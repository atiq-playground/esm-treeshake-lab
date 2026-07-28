import type { BenchmarkReport } from "./benchmark";
import { byteParts } from "./format-bytes";

export type UseCaseId = "baseline" | "wide" | "cycles" | "partial";

export type UseCaseMeta = {
  id: UseCaseId;
  /** Lab shorthand kept for docs cross-links */
  uc: string;
  /** Lab name */
  name: string;
  /** Plain label for charts / lists */
  plainTitle: string;
  /** One-line “what we measured” for humans */
  plainBlurb: string;
  /** Short x-axis word (fits under a bar) */
  axisLabel: string;
};

/**
 * Landing copy: GraphQL service that can reach N domain packages.
 * Typical bind is ~2–5 resolvers (functions) per package; singleton still
 * ships the rest of each package’s surface (~20 fns in fat cases).
 */
export const USE_CASE_ORDER: readonly UseCaseMeta[] = [
  {
    id: "baseline",
    uc: "UC1",
    name: "Baseline",
    plainTitle: "Thin module surface",
    plainBlurb:
      "100 packages, thin surface (~2 fns each). Schema still binds ~2 resolvers per package.",
    axisLabel: "Thin surface",
  },
  {
    id: "wide",
    uc: "UC2",
    name: "Wide",
    plainTitle: "Wide module surface",
    plainBlurb:
      "100 packages × ~20 exports each. Schema binds ~3 resolvers/package; registry ships the other ~17.",
    axisLabel: "Wide surface",
  },
  {
    id: "cycles",
    uc: "UC3",
    name: "Cycles",
    plainTitle: "Circular imports",
    plainBlurb:
      "Same ~3 resolvers/package, but packages ring-link — the cycle can drag neighbors you never call.",
    axisLabel: "Import cycles",
  },
  {
    id: "partial",
    uc: "UC4",
    name: "Partial",
    plainTitle: "Heavier schema bind",
    plainBlurb:
      "Heavier schema: ~5 resolvers per package. Still far from the full ~20-fn surface each package defines.",
    axisLabel: "Heavier bind",
  },
] as const;

export type UseCaseComparisonRow = {
  id: UseCaseId;
  uc: string;
  name: string;
  plainTitle: string;
  plainBlurb: string;
  /** Compact x-axis label */
  label: string;
  n: number;
  mode?: string;
  callSites?: number;
  fns?: number;
  cycles?: boolean;
  singletonBytes: number;
  esmBytes: number;
  singletonKb: number;
  esmKb: number;
  singletonPrimary: string;
  esmPrimary: string;
  bytesSavedPct: number;
  bytesSaved: number;
  sizeSavedPrimary: string;
  singletonVsEsmFactor?: number;
  /** Plain secondary line for the list */
  plainMeta: string;
};

export type UseCaseComparisonSummary = {
  rows: UseCaseComparisonRow[];
  /** Inclusive % saved across cases (min–max). */
  savedPctRange: { min: number; max: number };
  /** Case with the largest absolute bytes saved. */
  largestSave: UseCaseComparisonRow;
};

function resolveCaseId(
  report: BenchmarkReport,
  fallback: UseCaseId,
): UseCaseId {
  const raw = report.case;
  if (
    raw === "baseline" ||
    raw === "wide" ||
    raw === "cycles" ||
    raw === "partial"
  ) {
    return raw;
  }
  return fallback;
}

function perPackageResolvers(report: BenchmarkReport): number | null {
  const used = report.callSites;
  if (used == null || report.n <= 0) return null;
  return Number((used / report.n).toFixed(1));
}

function plainMeta(report: BenchmarkReport): string {
  const parts = [`${report.n} domain packages`];
  const perPkg = perPackageResolvers(report);
  if (report.callSites != null && perPkg != null) {
    parts.push(
      report.callSites === 1
        ? "1 resolver total"
        : `~${perPkg} resolvers/pkg (${report.callSites} total)`,
    );
  }
  if (report.cycles) {
    parts.push("cyclic graph");
  }
  return parts.join(" · ");
}

function plainCopy(
  meta: UseCaseMeta,
  report: BenchmarkReport,
): { plainTitle: string; plainBlurb: string } {
  const used = report.callSites ?? 1;
  const surface = report.surfaceFns;
  const n = report.n;
  const perPkg = perPackageResolvers(report) ?? used / Math.max(n, 1);
  const fns = report.fns ?? 2;

  if (meta.id === "partial") {
    const title =
      used === 1 ? "Wires 1 resolver" : `Wires ${used} resolvers`;
    const blurb =
      surface != null
        ? `~${perPkg} resolvers/package (1 fn ≈ 1 field). Binds ${used} of ${surface.toLocaleString("en-US")} surface fns — registry still ships ~${fns}/package.`
        : `~${perPkg} resolvers/package across ${n} packages — still not the whole registry.`;
    return { plainTitle: title, plainBlurb: blurb };
  }

  if (meta.id === "baseline") {
    return {
      plainTitle: meta.plainTitle,
      plainBlurb: `${n} packages with a thin surface (~${fns} fns each). Schema binds ~${perPkg} resolvers/package (${used} total); registry still side-effect-imports all ${n}.`,
    };
  }

  if (meta.id === "wide") {
    return {
      plainTitle: meta.plainTitle,
      plainBlurb: `${n} packages with a wide surface (~${fns} exports each). Schema binds ~${perPkg}/package; singleton still ships the other ~${Math.max(0, fns - perPkg)} unused exports per package.`,
    };
  }

  if (meta.id === "cycles") {
    return {
      plainTitle: meta.plainTitle,
      plainBlurb: `Same ~${perPkg} resolvers/package (${used} total), but packages ring-link — the cycle can drag neighbors you never call into ESM too.`,
    };
  }

  return { plainTitle: meta.plainTitle, plainBlurb: meta.plainBlurb };
}

/** Build comparison rows from the four latest bench artifacts. */
export function toUseCaseComparison(
  reports: Record<UseCaseId, BenchmarkReport>,
): UseCaseComparisonSummary {
  const rows: UseCaseComparisonRow[] = USE_CASE_ORDER.map((meta) => {
    const report = reports[meta.id];
    const id = resolveCaseId(report, meta.id);
    const singletonBytes = report.arms.singleton.bytes;
    const esmBytes = report.arms.esm.bytes;
    const bytesSaved =
      report.benefit.bytesSaved ??
      Math.max(0, singletonBytes - esmBytes);
    const bytesSavedPct =
      report.benefit.bytesSavedPct ??
      (singletonBytes === 0
        ? 0
        : Number(((bytesSaved / singletonBytes) * 100).toFixed(1)));
    const singletonSize =
      report.arms.singleton.size ?? byteParts(singletonBytes);
    const esmSize = report.arms.esm.size ?? byteParts(esmBytes);
    const savedSize = report.benefit.sizeSaved ?? byteParts(bytesSaved);

    const { plainTitle, plainBlurb } = plainCopy(meta, report);

    return {
      id,
      uc: meta.uc,
      name: meta.name,
      plainTitle,
      plainBlurb,
      label: meta.axisLabel,
      n: report.n,
      mode: report.mode,
      callSites: report.callSites,
      fns: report.fns,
      cycles: report.cycles,
      singletonBytes,
      esmBytes,
      singletonKb: Math.max(singletonBytes / 1024, 0.001),
      esmKb: Math.max(esmBytes / 1024, 0.001),
      singletonPrimary: singletonSize.primary,
      esmPrimary: esmSize.primary,
      bytesSavedPct,
      bytesSaved,
      sizeSavedPrimary: savedSize.primary,
      singletonVsEsmFactor: report.benefit.singletonVsEsmFactor,
      plainMeta: plainMeta(report),
    };
  });

  const pcts = rows.map((r) => r.bytesSavedPct);
  const largestSave = rows.reduce((best, row) =>
    row.bytesSaved > best.bytesSaved ? row : best,
  );

  return {
    rows,
    savedPctRange: {
      min: Math.min(...pcts),
      max: Math.max(...pcts),
    },
    largestSave,
  };
}
