import { describe, expect, test } from "bun:test";
import type { BenchmarkReport } from "./benchmark";
import { toUseCaseComparison } from "./use-case-comparison";

function arm(bytes: number) {
  return {
    bytes,
    buildMs: 1,
    markersUsedPresent: 1,
    markersUnusedRetained: 0,
    markersUnusedTotal: 0,
  };
}

function report(
  partial: Partial<BenchmarkReport> & {
    case: string;
    n: number;
    singleton: number;
    esm: number;
    pct: number;
  },
): BenchmarkReport {
  const bytesSaved = Math.max(0, partial.singleton - partial.esm);
  return {
    version: 1,
    timestamp: "2026-01-01T00:00:00.000Z",
    case: partial.case,
    n: partial.n,
    host: "esbuild",
    mode: partial.mode,
    callSites: partial.callSites,
    surfaceFns: partial.surfaceFns,
    fns: partial.fns,
    cycles: partial.cycles,
    arms: {
      singleton: arm(partial.singleton),
      esm: arm(partial.esm),
    },
    benefit: {
      bytesSavedPct: partial.pct,
      bytesSaved,
      unusedMarkersDelta: 0,
      singletonVsEsmFactor: partial.singleton / Math.max(partial.esm, 1),
    },
  };
}

describe("toUseCaseComparison", () => {
  test("orders UC1–UC4 with per-package resolver framing", () => {
    const summary = toUseCaseComparison({
      baseline: report({
        case: "baseline",
        n: 100,
        mode: "generated",
        callSites: 200,
        fns: 2,
        surfaceFns: 200,
        singleton: 270_000,
        esm: 235_000,
        pct: 12.8,
      }),
      wide: report({
        case: "wide",
        n: 100,
        mode: "generated",
        callSites: 300,
        fns: 20,
        surfaceFns: 2000,
        singleton: 4_250_000,
        esm: 460_000,
        pct: 89.2,
      }),
      cycles: report({
        case: "cycles",
        n: 100,
        mode: "generated",
        cycles: true,
        callSites: 300,
        fns: 20,
        surfaceFns: 2000,
        singleton: 4_250_000,
        esm: 470_000,
        pct: 89,
      }),
      partial: report({
        case: "partial",
        n: 100,
        mode: "generated",
        callSites: 500,
        fns: 20,
        surfaceFns: 2000,
        singleton: 4_250_000,
        esm: 900_000,
        pct: 78.7,
      }),
    });

    expect(summary.rows.map((r) => r.id)).toEqual([
      "baseline",
      "wide",
      "cycles",
      "partial",
    ]);
    expect(summary.rows.map((r) => r.plainTitle)).toEqual([
      "Thin module surface",
      "Wide module surface",
      "Circular imports",
      "Wires 500 resolvers",
    ]);
    expect(summary.rows[3]?.plainBlurb).toContain("~5 resolvers/package");
    expect(summary.rows[3]?.plainBlurb).toContain("1 fn ≈ 1 field");
    expect(summary.rows.map((r) => r.label)).toEqual([
      "Thin surface",
      "Wide surface",
      "Import cycles",
      "Heavier bind",
    ]);
    expect(summary.savedPctRange).toEqual({ min: 12.8, max: 89.2 });
    expect(summary.largestSave.id).toBe("wide");
    expect(summary.rows[0]?.plainMeta).toContain("100 domain packages");
    expect(summary.rows[0]?.plainMeta).toContain("~2 resolvers/pkg");
    expect(summary.rows[1]?.plainMeta).toContain("~3 resolvers/pkg");
    expect(summary.rows[2]?.plainMeta).toContain("cyclic graph");
    expect(summary.rows[1]?.singletonKb).toBeGreaterThan(
      summary.rows[1]?.esmKb ?? 0,
    );
  });
});
