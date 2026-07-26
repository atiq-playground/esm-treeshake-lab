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

export const USE_CASE_ORDER: readonly UseCaseMeta[] = [
  {
    id: "baseline",
    uc: "UC1",
    name: "Baseline",
    plainTitle: "Tiny demo",
    plainBlurb: "Small kit. App only needs one tool.",
    axisLabel: "Tiny",
  },
  {
    id: "wide",
    uc: "UC2",
    name: "Wide",
    plainTitle: "Huge unused kit",
    plainBlurb: "Each package has lots of tools. App still needs only one.",
    axisLabel: "Huge",
  },
  {
    id: "cycles",
    uc: "UC3",
    name: "Cycles",
    plainTitle: "Tangled packages",
    plainBlurb: "Packages hold hands in a circle, so friends get dragged in.",
    axisLabel: "Tangled",
  },
  {
    id: "partial",
    uc: "UC4",
    name: "Partial",
    plainTitle: "Need many tools",
    plainBlurb: "App uses many tools — but still not the whole kit.",
    axisLabel: "Many",
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

function plainMeta(report: BenchmarkReport): string {
  const parts = [`${report.n} packages`];
  if (report.callSites != null) {
    parts.push(
      report.callSites === 1
        ? "uses 1 tool"
        : `uses ${report.callSites} tools`,
    );
  }
  return parts.join(" · ");
}

function plainCopy(
  meta: UseCaseMeta,
  report: BenchmarkReport,
): { plainTitle: string; plainBlurb: string } {
  if (meta.id === "partial" && report.callSites != null) {
    const used = report.callSites;
    const surface = report.surfaceFns;
    const title = used === 1 ? "Need 1 tool" : `Need ${used} tools`;
    const blurb =
      surface != null
        ? `App uses ${used} of ${surface.toLocaleString("en-US")} tools — still not the whole kit.`
        : `App uses ${used} tools — still not the whole kit.`;
    return { plainTitle: title, plainBlurb: blurb };
  }

  if (meta.id === "baseline" && (report.callSites ?? 1) === 1) {
    return {
      plainTitle: meta.plainTitle,
      plainBlurb: `Small kit (${report.n} packages). App only needs 1 tool.`,
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
      bytesSavedPct: report.benefit.bytesSavedPct,
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
