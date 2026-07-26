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
  test("orders UC1–UC4 and surfaces absolute + percent impact", () => {
    const summary = toUseCaseComparison({
      baseline: report({
        case: "baseline",
        n: 3,
        mode: "smoke",
        singleton: 8000,
        esm: 200,
        pct: 97.5,
      }),
      wide: report({
        case: "wide",
        n: 100,
        mode: "generated",
        singleton: 8_000_000,
        esm: 200,
        pct: 100,
      }),
      cycles: report({
        case: "cycles",
        n: 100,
        mode: "generated",
        cycles: true,
        singleton: 4_000_000,
        esm: 12_000,
        pct: 99.7,
      }),
      partial: report({
        case: "partial",
        n: 100,
        mode: "generated",
        callSites: 50,
        surfaceFns: 2000,
        singleton: 4_000_000,
        esm: 6_000,
        pct: 99.9,
      }),
    });

    expect(summary.rows.map((r) => r.id)).toEqual([
      "baseline",
      "wide",
      "cycles",
      "partial",
    ]);
    expect(summary.rows.map((r) => r.plainTitle)).toEqual([
      "Tiny demo",
      "Huge unused kit",
      "Tangled packages",
      "Need 50 tools",
    ]);
    expect(summary.rows[3]?.plainBlurb).toBe(
      "App uses 50 of 2,000 tools — still not the whole kit.",
    );
    expect(summary.rows.map((r) => r.label)).toEqual([
      "Tiny",
      "Huge",
      "Tangled",
      "Many",
    ]);
    expect(summary.savedPctRange).toEqual({ min: 97.5, max: 100 });
    expect(summary.largestSave.id).toBe("wide");
    expect(summary.largestSave.bytesSaved).toBe(7_999_800);
    expect(summary.rows[0]?.plainMeta).toContain("3 packages");
    expect(summary.rows[1]?.singletonKb).toBeGreaterThan(
      summary.rows[1]?.esmKb ?? 0,
    );
  });
});
