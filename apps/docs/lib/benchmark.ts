import baselineJson from "../../../docs/lab/benchmark-latest.json";
import wideJson from "../../../docs/lab/benchmark-wide-latest.json";
import cyclesJson from "../../../docs/lab/benchmark-cycles-latest.json";
import partialJson from "../../../docs/lab/benchmark-partial-latest.json";
import thirdpartyJson from "../../../docs/lab/benchmark-thirdparty-latest.json";
import thirdpartyRealJson from "../../../docs/lab/benchmark-thirdparty-real-latest.json";
import fleetJson from "../../../docs/lab/benchmark-fleet-latest.json";
import coldstartJson from "../../../docs/lab/benchmark-coldstart-latest.json";
import { byteParts, type ByteParts } from "./format-bytes";
import {
  toUseCaseComparison,
  type UseCaseComparisonSummary,
  type UseCaseId,
} from "./use-case-comparison";

export type { ByteParts };
export type {
  UseCaseComparisonRow,
  UseCaseComparisonSummary,
  UseCaseId,
} from "./use-case-comparison";

export type ArmMetrics = {
  bytes: number;
  buildMs: number;
  markersUsedPresent?: number;
  markersUnusedRetained?: number;
  markersUnusedTotal?: number;
  thirdPartyMarkersRetained?: number;
  /** Cold-start: wall time to first export (ms). */
  importMs?: number;
  rssBytes?: number;
  heapUsedBytes?: number;
  size?: ByteParts;
  rssSize?: ByteParts;
  heapSize?: ByteParts;
};

export type ThirdPartyMeta = {
  count: number;
  bytesPerPackage: number;
  mode?: "stub" | "real";
};

export type FleetModeTotals = {
  consumers: number;
  singletonBytes: number;
  esmBytes: number;
  bytesSaved: number;
  bytesSavedPct: number;
  singletonVsEsmFactor?: number;
  singletonChunkCount?: number;
  esmChunkCount?: number;
  singletonBuildMs?: number;
  esmBuildMs?: number;
  singletonSize?: ByteParts;
  esmSize?: ByteParts;
  sizeSaved?: ByteParts;
};

export type FleetTotals = FleetModeTotals & {
  mode?: "naive" | "shared" | "both";
  naive?: FleetModeTotals;
  shared?: FleetModeTotals;
  /** % less singleton bytes vs naive ×M when shared is present. */
  sharingSavingsPct?: number;
};

export type BenchmarkReport = {
  version: number;
  timestamp: string;
  case?: UseCaseId | string;
  n: number;
  host: string;
  mode?: string;
  fns?: number;
  cycles?: boolean;
  callSites?: number;
  surfaceFns?: number;
  consumers?: number;
  fleetMode?: "naive" | "shared" | "both";
  thirdParty?: ThirdPartyMeta | null;
  note?: string;
  methodologyLimits?: string;
  arms: {
    singleton: ArmMetrics;
    esm: ArmMetrics;
  };
  benefit: {
    bytesSavedPct?: number;
    bytesSaved?: number;
    sizeSaved?: ByteParts;
    unusedMarkersDelta?: number;
    esmOfSingletonPct?: number;
    singletonVsEsmFactor?: number;
    callSiteCoveragePct?: number;
    unusedRemovedPct?: number;
    importMsSaved?: number;
    importMsSavedPct?: number;
    rssBytesSaved?: number;
    rssBytesSavedPct?: number;
    rssSizeSaved?: ByteParts;
  };
  fleet?: FleetTotals;
};

function enrichFleetMode(fleet: FleetModeTotals): FleetModeTotals {
  return {
    ...fleet,
    singletonSize: fleet.singletonSize ?? byteParts(fleet.singletonBytes),
    esmSize: fleet.esmSize ?? byteParts(fleet.esmBytes),
    sizeSaved: fleet.sizeSaved ?? byteParts(fleet.bytesSaved),
  };
}

function enrichFleet(fleet: FleetTotals): FleetTotals {
  return {
    ...enrichFleetMode(fleet),
    naive: fleet.naive ? enrichFleetMode(fleet.naive) : fleet.naive,
    shared: fleet.shared ? enrichFleetMode(fleet.shared) : fleet.shared,
  };
}

function enrichReport(report: BenchmarkReport): BenchmarkReport {
  const saved =
    report.benefit.bytesSaved ??
    Math.max(0, report.arms.singleton.bytes - report.arms.esm.bytes);

  return {
    ...report,
    arms: {
      singleton: {
        ...report.arms.singleton,
        size: report.arms.singleton.size ?? byteParts(report.arms.singleton.bytes),
        rssSize:
          report.arms.singleton.rssSize ??
          (report.arms.singleton.rssBytes != null
            ? byteParts(report.arms.singleton.rssBytes)
            : undefined),
        heapSize:
          report.arms.singleton.heapSize ??
          (report.arms.singleton.heapUsedBytes != null
            ? byteParts(report.arms.singleton.heapUsedBytes)
            : undefined),
      },
      esm: {
        ...report.arms.esm,
        size: report.arms.esm.size ?? byteParts(report.arms.esm.bytes),
        rssSize:
          report.arms.esm.rssSize ??
          (report.arms.esm.rssBytes != null
            ? byteParts(report.arms.esm.rssBytes)
            : undefined),
        heapSize:
          report.arms.esm.heapSize ??
          (report.arms.esm.heapUsedBytes != null
            ? byteParts(report.arms.esm.heapUsedBytes)
            : undefined),
      },
    },
    benefit: {
      ...report.benefit,
      bytesSaved: report.benefit.bytesSaved ?? saved,
      sizeSaved: report.benefit.sizeSaved ?? byteParts(saved),
      rssSizeSaved:
        report.benefit.rssSizeSaved ??
        (report.benefit.rssBytesSaved != null
          ? byteParts(report.benefit.rssBytesSaved)
          : undefined),
    },
    fleet: report.fleet ? enrichFleet(report.fleet) : report.fleet,
  };
}

/** Latest UC1 report: bundled at build (no runtime fs / R2). */
export function loadBenchmarkLatest(): BenchmarkReport {
  return enrichReport(baselineJson as BenchmarkReport);
}

/** All four use-case artifacts, keyed by case id. */
export function loadAllBenchmarkReports(): Record<UseCaseId, BenchmarkReport> {
  return {
    baseline: enrichReport(baselineJson as BenchmarkReport),
    wide: enrichReport(wideJson as BenchmarkReport),
    cycles: enrichReport(cyclesJson as BenchmarkReport),
    partial: enrichReport(partialJson as BenchmarkReport),
  };
}

/** Sibling research benches (3p stub/real + fleet + coldstart). */
export function loadExtendedBenchmarkReports(): {
  thirdparty: BenchmarkReport;
  thirdpartyReal: BenchmarkReport;
  fleet: BenchmarkReport;
  coldstart: BenchmarkReport;
} {
  return {
    thirdparty: enrichReport(thirdpartyJson as BenchmarkReport),
    thirdpartyReal: enrichReport(thirdpartyRealJson as BenchmarkReport),
    fleet: enrichReport(fleetJson as BenchmarkReport),
    coldstart: enrichReport(coldstartJson as BenchmarkReport),
  };
}

/** Chart-ready comparison across UC1–UC4. */
export function loadUseCaseComparison(): UseCaseComparisonSummary {
  return toUseCaseComparison(loadAllBenchmarkReports());
}
