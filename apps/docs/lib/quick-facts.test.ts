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
  test("uses short scannable copy with method in scopeNote, not per-card caveats", () => {
    const summary = toQuickFacts(landing);

    const byId = Object.fromEntries(summary.facts.map((f) => [f.id, f]));
    expect(byId["deploy-payload"]?.label).toBe("Deploy size");
    expect(byId["deploy-payload"]?.detail).toBe("89% smaller · 9× less to deploy");
    expect(byId["deploy-payload"]?.expand).toMatch(/N=100/);
    expect(byId["deploy-payload"]?.expand).toMatch(/Docker|egress|Worker/i);
    expect(byId["deploy-payload"]?.caveat).toBeUndefined();
    expect(byId["deploy-payload"]?.pipelineTags).toEqual([
      "Workers",
      "Docker",
      "egress",
    ]);

    expect(byId["n1000-singleton"]?.label).toBe("At 1000 packages");
    expect(byId["n1000-singleton"]?.headline).toMatch(/MB/);
    expect(byId["n1000-singleton"]?.detail).toMatch(/ESM stays/i);
    expect(byId["n1000-singleton"]?.detail.length).toBeLessThanOrEqual(70);
    expect(byId["n1000-singleton"]?.expand).toMatch(/N=1000/);
    expect(byId["n1000-singleton"]?.pipelineTags).toContain("esbuild");

    expect(byId["org-scale"]?.label).toBe("Org scale");
    expect(byId["org-scale"]?.evidence).toBe("extrapolated");
    expect(byId["org-scale"]?.detail).toBe("Where many orgs actually sit");
    expect(byId["org-scale"]?.expand).toMatch(/projected|linear/i);

    expect(byId["build-cpu"]?.label).toBe("Rebuild time");
    expect(byId["build-cpu"]?.detail).toBe("Cache-miss rebuild stays near-flat");
    expect(byId["build-cpu"]?.expand).toMatch(/esbuild|N=1000/i);
    expect(byId["build-cpu"]?.pipelineTags).toEqual(["CI", "esbuild"]);

    expect(byId["many-consumers"]?.evidence).toBe("operator");
    expect(byId["cold-start"]?.evidence).toBe("operator");
    expect(byId["cold-start"]?.pipelineTags).toEqual([
      "Node",
      "Workers",
      "memory",
    ]);
    expect(summary.scopeNote).toMatch(/Research|method|stub/i);
    expect(summary.assumptions.length).toBeGreaterThanOrEqual(2);
  });

  test("promotes many-consumers to measured fleet totals when fleet report is present", () => {
    const summary = toQuickFacts(landing, {
      fleet: fleetReport(),
    });
    const fact = summary.facts.find((f) => f.id === "many-consumers");
    expect(fact?.evidence).toBe("measured");
    expect(fact?.badge).toBe("Measured");
    expect(fact?.label).toBe("Many apps");
    expect(fact?.headline).toBe("12.56 MB → 19.5 KB");
    expect(fact?.detail).toBe("100 apps: pay once, not 100×");
    expect(fact?.expand).toMatch(/N=50/);
    expect(fact?.expand).toMatch(/99%/);
    expect(fact?.expand).toMatch(/shared|multi-entry/i);
    expect(fact?.caveat).toBeUndefined();
  });

  test("adds measured third-party ballast fact from sibling report", () => {
    const summary = toQuickFacts(landing, {
      thirdparty: thirdpartyReport(),
      thirdpartyReal: thirdpartyRealReport(),
    });
    const fact = summary.facts.find((f) => f.id === "third-party");
    expect(fact).toBeDefined();
    expect(fact?.evidence).toBe("measured");
    expect(fact?.label).toBe("Unused SDKs");
    expect(fact?.headline).toBe("386 KB → 32.4 KB");
    expect(fact?.detail).toBe("92% smaller; real npm ~99%");
    expect(fact?.expand).toMatch(/4×/);
    expect(fact?.expand).toMatch(/real npm/i);
    expect(fact?.expand).toMatch(/99%/);
    expect(fact?.caveat).toBeUndefined();
  });

  test("promotes cold-start to measured Node import + RSS when report present", () => {
    const summary = toQuickFacts(landing, {
      coldstart: coldstartReport(),
    });
    const fact = summary.facts.find((f) => f.id === "cold-start");
    expect(fact?.evidence).toBe("measured");
    expect(fact?.label).toBe("Cold import");
    expect(fact?.headline).toBe("1.97 ms → 0.33 ms");
    expect(fact?.detail).toMatch(/^83% faster · .+ less RSS$/);
    expect(fact?.expand).toMatch(/N=50|bundled|baseline|isolate/i);
    expect(fact?.caveat).toBeUndefined();
  });

  test("keeps a short smoke warning when coldstart N understates the gap", () => {
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
    expect(fact?.detail).toMatch(/smoke|understates|N=50/i);
    expect(fact?.expand).toMatch(/smoke|baseline|N=50/i);
    expect(fact?.detail.length).toBeLessThanOrEqual(80);
  });

  test("omits third-party fact and keeps operator many-consumers without extended reports", () => {
    const summary = toQuickFacts(landing);
    expect(summary.facts.some((f) => f.id === "third-party")).toBe(false);
    expect(
      summary.facts.find((f) => f.id === "many-consumers")?.evidence,
    ).toBe("operator");
    expect(
      summary.facts.find((f) => f.id === "many-consumers")?.detail.length,
    ).toBeLessThanOrEqual(70);
  });

  test("wires an example app vignette on every fact (app + 3–5 stack lines)", () => {
    const summary = toQuickFacts(landing, {
      thirdparty: thirdpartyReport(),
      thirdpartyReal: thirdpartyRealReport(),
      fleet: fleetReport(),
      coldstart: coldstartReport(),
    });

    for (const fact of summary.facts) {
      expect(fact.example.app.length).toBeGreaterThan(0);
      expect(fact.example.stack.length).toBeGreaterThanOrEqual(3);
      expect(fact.example.stack.length).toBeLessThanOrEqual(5);
      for (const line of fact.example.stack) {
        expect(line.length).toBeGreaterThan(0);
      }
    }

    const byId = Object.fromEntries(summary.facts.map((f) => [f.id, f]));
    expect(byId["deploy-payload"]?.example.app).toMatch(/Edge GraphQL/i);
    expect(byId["n1000-singleton"]?.example.app).toMatch(/Plugin platform/i);
    expect(byId["org-scale"]?.example.app).toMatch(/Org monorepo/i);
    expect(byId["build-cpu"]?.example.app).toMatch(/CI cache/i);
    expect(byId["third-party"]?.example.app).toMatch(/BFF/i);
    expect(byId["many-consumers"]?.example.app).toMatch(/Worker apps/i);
    expect(byId["cold-start"]?.example.app).toMatch(/cold import/i);
  });
});
