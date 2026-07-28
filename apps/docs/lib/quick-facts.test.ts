import { describe, expect, test } from "bun:test";
import type { BenchmarkReport } from "./benchmark";
import { toQuickFacts } from "./quick-facts";

function arm(bytes: number, buildMs = 80) {
  return {
    bytes,
    buildMs,
    markersUsedPresent: 100,
    markersUnusedRetained: 1900,
    markersUnusedTotal: 1900,
  };
}

function wideReport(): BenchmarkReport {
  return {
    version: 1,
    timestamp: "2026-01-01T00:00:00.000Z",
    case: "wide",
    n: 100,
    host: "esbuild",
    mode: "generated",
    callSites: 300,
    fns: 20,
    surfaceFns: 2000,
    arms: {
      singleton: arm(4_251_131, 82),
      esm: arm(459_451, 35),
    },
    benefit: {
      bytesSavedPct: 89.2,
      bytesSaved: 3_791_680,
      unusedMarkersDelta: 1700,
      singletonVsEsmFactor: 9.3,
    },
  };
}

function stub(caseId: string, n = 100): BenchmarkReport {
  return {
    ...wideReport(),
    case: caseId,
    n,
  };
}

function thirdpartyReport(): BenchmarkReport {
  return {
    version: 1,
    timestamp: "2026-07-28T02:15:53.891Z",
    case: "thirdparty",
    n: 100,
    host: "esbuild",
    mode: "generated",
    callSites: 1,
    fns: 2,
    consumers: 1,
    thirdParty: { count: 4, bytesPerPackage: 32768, mode: "stub" },
    arms: {
      singleton: arm(395_274, 47),
      esm: arm(33_191, 3),
    },
    benefit: {
      bytesSavedPct: 91.6,
      bytesSaved: 362_083,
      unusedMarkersDelta: 100,
      singletonVsEsmFactor: 11.9,
    },
  };
}

function thirdpartyRealReport(): BenchmarkReport {
  return {
    version: 1,
    timestamp: "2026-07-28T02:28:13.982Z",
    case: "thirdparty",
    n: 100,
    host: "esbuild",
    mode: "generated",
    callSites: 1,
    fns: 2,
    consumers: 1,
    thirdParty: { count: 4, bytesPerPackage: 32768, mode: "real" },
    arms: {
      singleton: arm(355_478, 68),
      esm: arm(2_484, 15),
    },
    benefit: {
      bytesSavedPct: 99.3,
      bytesSaved: 352_994,
      unusedMarkersDelta: 100,
      singletonVsEsmFactor: 143.1,
    },
  };
}

function fleetReport(): BenchmarkReport {
  return {
    version: 1,
    timestamp: "2026-07-28T02:15:54.116Z",
    case: "fleet",
    n: 50,
    host: "esbuild",
    mode: "generated",
    callSites: 1,
    fns: 2,
    consumers: 100,
    arms: {
      singleton: arm(131_678, 30),
      esm: arm(200, 2),
    },
    benefit: {
      bytesSavedPct: 99.8,
      bytesSaved: 131_478,
      unusedMarkersDelta: 50,
      singletonVsEsmFactor: 658.4,
    },
    fleet: {
      consumers: 100,
      singletonBytes: 13_167_800,
      esmBytes: 20_000,
      bytesSaved: 13_147_800,
      bytesSavedPct: 99.8,
      singletonVsEsmFactor: 658.4,
      mode: "both",
      sharingSavingsPct: 98.8,
      shared: {
        consumers: 100,
        singletonBytes: 158_834,
        esmBytes: 16_400,
        bytesSaved: 142_434,
        bytesSavedPct: 89.7,
        singletonVsEsmFactor: 9.7,
      },
    },
  };
}

function coldstartReport(): BenchmarkReport {
  return {
    version: 1,
    timestamp: "2026-07-28T02:28:14.553Z",
    case: "coldstart",
    n: 50,
    host: "node",
    mode: "generated",
    arms: {
      singleton: {
        bytes: 131_678,
        buildMs: 32,
        importMs: 1.97,
        rssBytes: 48_283_648,
        heapUsedBytes: 4_500_000,
      },
      esm: {
        bytes: 200,
        buildMs: 2,
        importMs: 0.33,
        rssBytes: 47_185_920,
        heapUsedBytes: 4_200_000,
      },
    },
    benefit: {
      importMsSaved: 1.64,
      importMsSavedPct: 83.2,
      rssBytesSaved: 1_097_728,
      rssBytesSavedPct: 2.3,
    },
  };
}

const landing = {
  baseline: stub("baseline"),
  wide: wideReport(),
  cycles: stub("cycles"),
  partial: stub("partial"),
};

describe("toQuickFacts", () => {
  test("marks deploy and N=1000 as measured; org-scale as extrapolated", () => {
    const summary = toQuickFacts(landing);

    const byId = Object.fromEntries(summary.facts.map((f) => [f.id, f]));
    expect(byId["deploy-payload"]?.evidence).toBe("measured");
    expect(byId["n1000-singleton"]?.evidence).toBe("measured");
    expect(byId["n1000-singleton"]?.headline).toMatch(/MB/);
    expect(byId["org-scale"]?.evidence).toBe("extrapolated");
    expect(byId["org-scale"]?.headline).toContain("–");
    expect(byId["build-cpu"]?.evidence).toBe("measured");
    expect(byId["many-consumers"]?.evidence).toBe("operator");
    expect(byId["cold-start"]?.evidence).toBe("operator");
    expect(summary.scopeNote).toMatch(/first-party/i);
    expect(summary.assumptions.length).toBeGreaterThanOrEqual(2);
  });

  test("promotes many-consumers to measured fleet totals when fleet report is present", () => {
    const summary = toQuickFacts(landing, {
      fleet: fleetReport(),
    });
    const fact = summary.facts.find((f) => f.id === "many-consumers");
    expect(fact?.evidence).toBe("measured");
    expect(fact?.badge).toBe("Measured");
    expect(fact?.headline).toBe("12.56 MB → 19.5 KB");
    expect(fact?.detail).toMatch(/N=50/);
    expect(fact?.detail).toMatch(/×\s*100|M=100/);
    expect(fact?.detail).toMatch(/99\.8%/);
    expect(fact?.detail).toMatch(/multi-entry|shared/i);
    expect(fact?.detail).toMatch(/98\.8%/);
    expect(fact?.caveat?.toLowerCase()).toMatch(/naive|shared|multi-entry/);
  });

  test("adds measured third-party ballast fact from sibling report", () => {
    const summary = toQuickFacts(landing, {
      thirdparty: thirdpartyReport(),
      thirdpartyReal: thirdpartyRealReport(),
    });
    const fact = summary.facts.find((f) => f.id === "third-party");
    expect(fact).toBeDefined();
    expect(fact?.evidence).toBe("measured");
    expect(fact?.headline).toBe("386 KB → 32.4 KB");
    expect(fact?.detail).toMatch(/91\.6%/);
    expect(fact?.detail).toMatch(/4/);
    expect(fact?.detail).toMatch(/real npm/i);
    expect(fact?.detail).toMatch(/99\.3%/);
    expect(fact?.caveat?.toLowerCase()).toMatch(/stub|real|pin/);
  });

  test("promotes cold-start to measured Node import + RSS when report present", () => {
    const summary = toQuickFacts(landing, {
      coldstart: coldstartReport(),
    });
    const fact = summary.facts.find((f) => f.id === "cold-start");
    expect(fact?.evidence).toBe("measured");
    expect(fact?.headline).toBe("1.97 ms → 0.33 ms");
    expect(fact?.detail).toMatch(/83\.2%/);
    expect(fact?.detail).toMatch(/RSS/i);
    expect(fact?.caveat?.toLowerCase()).toMatch(/bundled|baseline|isolate/);
  });

  test("caveats louder when coldstart report is smoke N with tiny RSS Δ", () => {
    const summary = toQuickFacts(landing, {
      coldstart: {
        ...coldstartReport(),
        n: 3,
        mode: "smoke",
        arms: {
          singleton: {
            bytes: 8337,
            buildMs: 16,
            importMs: 0.5,
            rssBytes: 47_230_976,
            heapUsedBytes: 4_229_560,
          },
          esm: {
            bytes: 192,
            buildMs: 3,
            importMs: 0.33,
            rssBytes: 47_206_400,
            heapUsedBytes: 4_207_968,
          },
        },
        benefit: {
          importMsSaved: 0.17,
          importMsSavedPct: 34,
          rssBytesSaved: 24_576,
          rssBytesSavedPct: 0.1,
        },
      },
    });
    const fact = summary.facts.find((f) => f.id === "cold-start");
    expect(fact?.headline).toBe("0.5 ms → 0.33 ms");
    expect(fact?.caveat?.toLowerCase()).toMatch(/smoke|almost flat|n=50|deploy-byte/);
  });

  test("omits third-party fact and keeps operator many-consumers without extended reports", () => {
    const summary = toQuickFacts(landing);
    expect(summary.facts.some((f) => f.id === "third-party")).toBe(false);
    expect(
      summary.facts.find((f) => f.id === "many-consumers")?.evidence,
    ).toBe("operator");
  });
});
