import { describe, expect, test } from "bun:test";
import {
  assertCyclesWithThirdParty,
  buildPipelineArmTimings,
  buildProofFromEnv,
  coldStartBenefit,
  DEFAULT_THIRD_PARTY,
  isBenchCase,
  mergePipelineReport,
  parseFleetMode,
  parseThirdPartyConfig,
  percentile,
  pipelineTotalMs,
  REALISTIC_DEFAULTS,
  REAL_THIRD_PARTY_PACKAGES,
  REQUEST_DISCLAIMER,
  reportArtifactBase,
  scaleFleetMetrics,
  sharingSavingsPct,
  SMOKE_THIRD_PARTY,
  sumOutputBytes,
  buildRequestArmMetrics,
  REQUEST_BENCH_DEFAULTS,
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

  test("routes realistic GraphQL case to its own sibling artifact", () => {
    expect(reportArtifactBase("realistic")).toBe(
      "benchmark-realistic-latest",
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
    expect(isBenchCase("realistic")).toBe(true);
    expect(isBenchCase("nope")).toBe(false);
  });
});

describe("assertCyclesWithThirdParty", () => {
  test("allows cycles + --3p=real only for realistic", () => {
    expect(() =>
      assertCyclesWithThirdParty("realistic", true, "real"),
    ).not.toThrow();
  });

  test("rejects cycles + 3p outside realistic (UC3, thirdparty, etc.)", () => {
    expect(() =>
      assertCyclesWithThirdParty("cycles", true, "real"),
    ).toThrow(/realistic/);
    expect(() =>
      assertCyclesWithThirdParty("cycles", true, "stub"),
    ).toThrow(/realistic/);
    expect(() =>
      assertCyclesWithThirdParty("thirdparty", true, "real"),
    ).toThrow(/realistic/);
    expect(() =>
      assertCyclesWithThirdParty("wide", true, "stub"),
    ).toThrow(/realistic/);
  });

  test("rejects realistic + cycles with stub 3p", () => {
    expect(() =>
      assertCyclesWithThirdParty("realistic", true, "stub"),
    ).toThrow(/3p=real/);
  });

  test("allows cycles alone or 3p alone on any case", () => {
    expect(() =>
      assertCyclesWithThirdParty("cycles", true, null),
    ).not.toThrow();
    expect(() =>
      assertCyclesWithThirdParty("thirdparty", false, "real"),
    ).not.toThrow();
    expect(() =>
      assertCyclesWithThirdParty("baseline", false, null),
    ).not.toThrow();
  });
});

describe("REALISTIC_DEFAULTS", () => {
  test("locks GraphQL-shaped preset (N=100, fns=20, used=1000, cycles + real 3p)", () => {
    expect(REALISTIC_DEFAULTS).toEqual({
      n: 100,
      fns: 20,
      used: 1000,
      cycles: true,
      thirdPartyMode: "real",
    });
  });
});

describe("pipelineTotalMs", () => {
  test("sums generate + install + bundle + upload (null upload counts as 0)", () => {
    expect(
      pipelineTotalMs({
        generateMs: 100,
        installMs: 200,
        bundleMs: 50,
        artifactUploadMs: null,
      }),
    ).toBe(350);
    expect(
      pipelineTotalMs({
        generateMs: 10,
        installMs: 20,
        bundleMs: 30,
        artifactUploadMs: 40,
      }),
    ).toBe(100);
  });
});

describe("buildPipelineArmTimings", () => {
  test("builds a per-arm pipeline row with computed total", () => {
    expect(
      buildPipelineArmTimings({
        generateMs: 12,
        installMs: 34,
        bundleMs: 56,
        artifactBytes: 1000,
        artifactUploadMs: null,
      }),
    ).toEqual({
      generateMs: 12,
      installMs: 34,
      bundleMs: 56,
      artifactBytes: 1000,
      artifactUploadMs: null,
      pipelineTotalMs: 102,
    });
  });
});

describe("mergePipelineReport", () => {
  test("fills one cache mode without wiping the other", () => {
    const coldArms = {
      singleton: buildPipelineArmTimings({
        generateMs: 1,
        installMs: 2,
        bundleMs: 3,
        artifactBytes: 10,
        artifactUploadMs: null,
      }),
      esm: buildPipelineArmTimings({
        generateMs: 1,
        installMs: 2,
        bundleMs: 1,
        artifactBytes: 4,
        artifactUploadMs: null,
      }),
    };
    const warmArms = {
      singleton: buildPipelineArmTimings({
        generateMs: 0,
        installMs: 1,
        bundleMs: 2,
        artifactBytes: 10,
        artifactUploadMs: 5,
      }),
      esm: buildPipelineArmTimings({
        generateMs: 0,
        installMs: 1,
        bundleMs: 1,
        artifactBytes: 4,
        artifactUploadMs: 5,
      }),
    };
    const afterCold = mergePipelineReport(null, "cold", coldArms);
    expect(afterCold.cold).toEqual(coldArms);
    expect(afterCold.warm).toBeNull();
    const afterWarm = mergePipelineReport(afterCold, "warm", warmArms);
    expect(afterWarm.cold).toEqual(coldArms);
    expect(afterWarm.warm).toEqual(warmArms);
  });
});

describe("buildProofFromEnv", () => {
  test("local runner leaves GitHub run fields null", () => {
    expect(buildProofFromEnv({}, "2026-07-28T12:00:00.000Z")).toEqual({
      timestamp: "2026-07-28T12:00:00.000Z",
      githubRunUrl: null,
      githubRunId: null,
      runner: "local",
    });
  });

  test("github-actions runner builds run URL from GITHUB_*", () => {
    expect(
      buildProofFromEnv(
        {
          GITHUB_ACTIONS: "true",
          GITHUB_RUN_ID: "12345",
          GITHUB_SERVER_URL: "https://github.com",
          GITHUB_REPOSITORY: "atiq-playground/esm-treeshake-lab",
        },
        "2026-07-28T12:00:00.000Z",
      ),
    ).toEqual({
      timestamp: "2026-07-28T12:00:00.000Z",
      githubRunUrl:
        "https://github.com/atiq-playground/esm-treeshake-lab/actions/runs/12345",
      githubRunId: "12345",
      runner: "github-actions",
    });
  });
});

describe("percentile", () => {
  test("returns p50 and p95 from sorted samples", () => {
    const samples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(samples, 50)).toBe(5.5);
    expect(percentile(samples, 95)).toBe(9.55);
  });
});

describe("REQUEST_DISCLAIMER", () => {
  test("states Node bench is not CF isolate or prod gateway RPS", () => {
    expect(REQUEST_DISCLAIMER).toMatch(/Cloudflare isolate/i);
    expect(REQUEST_DISCLAIMER).toMatch(/gateway RPS/i);
  });
});

describe("buildRequestArmMetrics", () => {
  test("computes p50/p95 and records cpu + memory from samples", () => {
    const latencies = [10, 12, 11, 13, 14, 15, 16, 17, 18, 20];
    const metrics = buildRequestArmMetrics({
      latenciesMs: latencies,
      warmup: 50,
      measured: 10,
      concurrency: 1,
      cpuUserMs: 12.5,
      cpuSystemMs: 3.25,
      rssBytes: 40_000_000,
      heapUsedBytes: 20_000_000,
    });
    expect(metrics.warmup).toBe(50);
    expect(metrics.measured).toBe(10);
    expect(metrics.concurrency).toBe(1);
    expect(metrics.latencyMs.p50).toBe(14.5);
    expect(metrics.latencyMs.p95).toBe(19.1);
    expect(metrics.cpuUserMs).toBe(12.5);
    expect(metrics.cpuSystemMs).toBe(3.25);
    expect(metrics.rssBytes).toBe(40_000_000);
    expect(metrics.heapUsedBytes).toBe(20_000_000);
  });
});

describe("REQUEST_BENCH_DEFAULTS", () => {
  test("locks warmup 50 / measured 1000 / concurrency 1", () => {
    expect(REQUEST_BENCH_DEFAULTS).toEqual({
      warmup: 50,
      measured: 1000,
      concurrency: 1,
    });
  });
});
