import { describe, expect, test } from "bun:test";
import {
  coldStartBenefit,
  DEFAULT_THIRD_PARTY,
  isBenchCase,
  parseFleetMode,
  parseThirdPartyConfig,
  REAL_THIRD_PARTY_PACKAGES,
  reportArtifactBase,
  scaleFleetMetrics,
  sharingSavingsPct,
  SMOKE_THIRD_PARTY,
  sumOutputBytes,
} from "./bench-metrics.ts";

describe("reportArtifactBase", () => {
  test("keeps UC1–UC4 sibling names and never aliases thirdparty/fleet onto baseline", () => {
    expect(reportArtifactBase("baseline")).toBe("benchmark-latest");
    expect(reportArtifactBase("wide")).toBe("benchmark-wide-latest");
    expect(reportArtifactBase("cycles")).toBe("benchmark-cycles-latest");
    expect(reportArtifactBase("partial")).toBe("benchmark-partial-latest");
    expect(reportArtifactBase("thirdparty")).toBe(
      "benchmark-thirdparty-latest",
    );
    expect(reportArtifactBase("fleet")).toBe("benchmark-fleet-latest");
  });

  test("routes real npm 3p and coldstart to sibling artifact names", () => {
    expect(
      reportArtifactBase("thirdparty", { thirdPartyMode: "real" }),
    ).toBe("benchmark-thirdparty-real-latest");
    expect(reportArtifactBase("thirdparty", { thirdPartyMode: "stub" })).toBe(
      "benchmark-thirdparty-latest",
    );
    expect(reportArtifactBase("coldstart")).toBe(
      "benchmark-coldstart-latest",
    );
  });
});

describe("scaleFleetMetrics", () => {
  test("multiplies identical per-consumer graphs across M consumers", () => {
    const fleet = scaleFleetMetrics(
      { singletonBytes: 1000, esmBytes: 100, bytesSaved: 900 },
      50,
    );
    expect(fleet).toEqual({
      consumers: 50,
      singletonBytes: 50_000,
      esmBytes: 5_000,
      bytesSaved: 45_000,
      bytesSavedPct: 90,
      singletonVsEsmFactor: 10,
    });
  });

  test("rejects non-integer or sub-1 consumer counts", () => {
    expect(() =>
      scaleFleetMetrics(
        { singletonBytes: 1, esmBytes: 1, bytesSaved: 0 },
        0,
      ),
    ).toThrow();
    expect(() =>
      scaleFleetMetrics(
        { singletonBytes: 1, esmBytes: 1, bytesSaved: 0 },
        1.5,
      ),
    ).toThrow();
  });
});

describe("sharingSavingsPct", () => {
  test("reports how much multi-entry shared undercuts naive ×M", () => {
    expect(sharingSavingsPct(10_000, 2_500)).toBe(75);
    expect(sharingSavingsPct(0, 0)).toBe(0);
  });
});

describe("sumOutputBytes", () => {
  test("sums file sizes for multi-entry outdir totals", () => {
    expect(sumOutputBytes([100, 200, 50])).toBe(350);
    expect(sumOutputBytes([])).toBe(0);
  });
});

describe("parseFleetMode", () => {
  test("defaults to both; accepts naive|shared|both", () => {
    expect(parseFleetMode(undefined)).toBe("both");
    expect(parseFleetMode("naive")).toBe("naive");
    expect(parseFleetMode("shared")).toBe("shared");
    expect(parseFleetMode("both")).toBe("both");
    expect(() => parseFleetMode("nope")).toThrow(/fleet-mode/);
  });
});

describe("parseThirdPartyConfig", () => {
  test("defaults to research-sized stubs locally and tiny stubs for smoke", () => {
    expect(parseThirdPartyConfig({})).toEqual(DEFAULT_THIRD_PARTY);
    expect(parseThirdPartyConfig({ smoke: true })).toEqual(SMOKE_THIRD_PARTY);
  });

  test("accepts explicit count, bytes, and mode overrides", () => {
    expect(
      parseThirdPartyConfig({ count: 3, bytesPerPackage: 4096 }),
    ).toEqual({ count: 3, bytesPerPackage: 4096, mode: "stub" });
    expect(parseThirdPartyConfig({ mode: "real", count: 3 })).toEqual({
      count: 3,
      bytesPerPackage: DEFAULT_THIRD_PARTY.bytesPerPackage,
      mode: "real",
    });
  });

  test("rejects unknown --3p mode", () => {
    expect(() => parseThirdPartyConfig({ mode: "nope" as "stub" })).toThrow(
      /3p/,
    );
  });

  test("pins a reproducible real npm catalog covering core + extras", () => {
    expect(REAL_THIRD_PARTY_PACKAGES.core.npm).toBe("graphql");
    expect(REAL_THIRD_PARTY_PACKAGES.extras.length).toBeGreaterThanOrEqual(3);
    for (const pkg of [
      REAL_THIRD_PARTY_PACKAGES.core,
      ...REAL_THIRD_PARTY_PACKAGES.extras,
    ]) {
      expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
      expect(pkg.sideEffectImport.length).toBeGreaterThan(0);
    }
  });
});

describe("coldStartBenefit", () => {
  test("compares import wall time and RSS between arms", () => {
    const benefit = coldStartBenefit(
      { importMs: 40, rssBytes: 80_000_000, heapUsedBytes: 40_000_000 },
      { importMs: 5, rssBytes: 50_000_000, heapUsedBytes: 20_000_000 },
    );
    expect(benefit.importMsSaved).toBe(35);
    expect(benefit.rssBytesSaved).toBe(30_000_000);
    expect(benefit.importMsSavedPct).toBe(87.5);
    expect(benefit.rssBytesSavedPct).toBe(37.5);
  });
});

describe("isBenchCase", () => {
  test("accepts extended cases", () => {
    expect(isBenchCase("thirdparty")).toBe(true);
    expect(isBenchCase("fleet")).toBe(true);
    expect(isBenchCase("coldstart")).toBe(true);
    expect(isBenchCase("nope")).toBe(false);
  });
});
