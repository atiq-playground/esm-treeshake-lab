import reportJson from "../../../docs/lab/benchmark-latest.json";
import { byteParts, type ByteParts } from "./format-bytes";

export type { ByteParts };

export type ArmMetrics = {
  bytes: number;
  buildMs: number;
  markersUsedPresent: number;
  markersUnusedRetained: number;
  markersUnusedTotal: number;
  size?: ByteParts;
};

export type BenchmarkReport = {
  version: number;
  timestamp: string;
  n: number;
  host: string;
  mode?: string;
  arms: {
    singleton: ArmMetrics;
    esm: ArmMetrics;
  };
  benefit: {
    bytesSavedPct: number;
    bytesSaved?: number;
    sizeSaved?: ByteParts;
    unusedMarkersDelta: number;
    esmOfSingletonPct?: number;
    singletonVsEsmFactor?: number;
    callSiteCoveragePct?: number;
    unusedRemovedPct?: number;
  };
};

/** Latest UC1 report: bundled at build (no runtime fs / R2). */
export function loadBenchmarkLatest(): BenchmarkReport {
  const report = reportJson as BenchmarkReport;
  const saved =
    report.benefit.bytesSaved ??
    Math.max(0, report.arms.singleton.bytes - report.arms.esm.bytes);

  return {
    ...report,
    arms: {
      singleton: {
        ...report.arms.singleton,
        size: report.arms.singleton.size ?? byteParts(report.arms.singleton.bytes),
      },
      esm: {
        ...report.arms.esm,
        size: report.arms.esm.size ?? byteParts(report.arms.esm.bytes),
      },
    },
    benefit: {
      ...report.benefit,
      bytesSaved: saved,
      sizeSaved: report.benefit.sizeSaved ?? byteParts(saved),
    },
  };
}
