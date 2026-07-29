/**
 * Pure helpers for scale-bench report naming, fleet scaling, and 3p config.
 * Kept free of esbuild / fs so unit tests can lock report + CLI contracts.
 */

export type BenchCase =
  | "baseline"
  | "wide"
  | "cycles"
  | "partial"
  | "thirdparty"
  | "fleet"
  | "coldstart"
  | "realistic";

export const BENCH_CASES: readonly BenchCase[] = [
  "baseline",
  "wide",
  "cycles",
  "partial",
  "thirdparty",
  "fleet",
  "coldstart",
  "realistic",
] as const;

/** GraphQL-shaped preset: cycles + real 3p + multi call sites (~10/pkg). */
export const REALISTIC_DEFAULTS = {
  n: 100,
  fns: 20,
  used: 1000,
  cycles: true,
  thirdPartyMode: "real" as const,
} as const;

export type ThirdPartyMode = "stub" | "real";

export type FleetMode = "naive" | "shared" | "both";

export type ReportArtifactOpts = {
  thirdPartyMode?: ThirdPartyMode;
};

/** Sibling artifact basename under docs/lab/ (no extension). */
export function reportArtifactBase(
  benchCase: BenchCase,
  opts: ReportArtifactOpts = {},
): string {
  switch (benchCase) {
    case "baseline":
      return "benchmark-latest";
    case "wide":
      return "benchmark-wide-latest";
    case "cycles":
      return "benchmark-cycles-latest";
    case "partial":
      return "benchmark-partial-latest";
    case "thirdparty":
      return opts.thirdPartyMode === "real"
        ? "benchmark-thirdparty-real-latest"
        : "benchmark-thirdparty-latest";
    case "fleet":
      return "benchmark-fleet-latest";
    case "coldstart":
      return "benchmark-coldstart-latest";
    case "realistic":
      return "benchmark-realistic-latest";
  }
}

/**
 * Cycles + third-party ballast may only combine under `--case=realistic`
 * with `--3p=real`. UC3 / thirdparty / others keep those knobs exclusive.
 */
export function assertCyclesWithThirdParty(
  benchCase: string,
  cycles: boolean,
  thirdPartyMode: ThirdPartyMode | null | undefined,
): void {
  if (!cycles || thirdPartyMode == null) return;
  if (benchCase === "realistic" && thirdPartyMode === "real") return;
  if (benchCase === "realistic") {
    throw new Error(
      "Cycles combined with --3p requires --3p=real for --case=realistic",
    );
  }
  throw new Error(
    "Cycles combined with --3p is only allowed for --case=realistic with --3p=real",
  );
}

export type FleetPerConsumer = {
  singletonBytes: number;
  esmBytes: number;
  bytesSaved: number;
};

export type FleetTotals = FleetPerConsumer & {
  consumers: number;
  /** Fleet bytes saved as % of fleet singleton. */
  bytesSavedPct: number;
  /** How many times larger fleet singleton is vs fleet ESM. */
  singletonVsEsmFactor: number;
};

/**
 * Scale a single-consumer pair of bundle sizes across M identical consumers.
 * Honest for “each app pays the module graph again”; not a multi-entry bundle.
 */
export function scaleFleetMetrics(
  perConsumer: FleetPerConsumer,
  consumers: number,
): FleetTotals {
  if (!Number.isFinite(consumers) || consumers < 1 || !Number.isInteger(consumers)) {
    throw new Error("consumers must be an integer >= 1");
  }
  const singletonBytes = perConsumer.singletonBytes * consumers;
  const esmBytes = perConsumer.esmBytes * consumers;
  const bytesSaved = Math.max(0, singletonBytes - esmBytes);
  const bytesSavedPct =
    singletonBytes === 0
      ? 0
      : Number(((bytesSaved / singletonBytes) * 100).toFixed(1));
  const singletonVsEsmFactor =
    esmBytes === 0 ? 0 : Number((singletonBytes / esmBytes).toFixed(1));
  return {
    consumers,
    singletonBytes,
    esmBytes,
    bytesSaved,
    bytesSavedPct,
    singletonVsEsmFactor,
  };
}

/** % of naive ×M singleton bytes avoided by multi-entry shared chunks. */
export function sharingSavingsPct(
  naiveSingletonBytes: number,
  sharedSingletonBytes: number,
): number {
  if (naiveSingletonBytes === 0) return 0;
  return Number(
    (
      ((naiveSingletonBytes - sharedSingletonBytes) / naiveSingletonBytes) *
      100
    ).toFixed(1),
  );
}

/** Sum esbuild multi-entry outdir file sizes. */
export function sumOutputBytes(fileByteLengths: readonly number[]): number {
  return fileByteLengths.reduce((acc, n) => acc + n, 0);
}

export function parseFleetMode(raw: string | undefined): FleetMode {
  const value = raw ?? "both";
  if (value === "naive" || value === "shared" || value === "both") {
    return value;
  }
  throw new Error("Invalid --fleet-mode (naive|shared|both)");
}

export type ThirdPartyConfig = {
  /** Total 3p packages (1 core + extras). */
  count: number;
  /** Ballast bytes per stub package body (approx). Ignored for mode=real. */
  bytesPerPackage: number;
  /** stub = generated @lab/3p-*; real = pinned npm deps. */
  mode: ThirdPartyMode;
};

export const DEFAULT_THIRD_PARTY: ThirdPartyConfig = {
  count: 4,
  bytesPerPackage: 32_768,
  mode: "stub",
};

/** Smoke-friendly 3p weight: still exercises markers, stays tiny for CI. */
export const SMOKE_THIRD_PARTY: ThirdPartyConfig = {
  count: 2,
  bytesPerPackage: 2_048,
  mode: "stub",
};

/** Pinned real npm packages for --3p=real (lockfile must match versions). */
export type RealThirdPartySpec = {
  /** npm package name */
  npm: string;
  version: string;
  /** Side-effect import line(s) that force retention under esbuild. */
  sideEffectImport: string;
  /** Stable marker string embedded so reports can count retention. */
  marker: string;
};

export const REAL_THIRD_PARTY_PACKAGES: {
  core: RealThirdPartySpec;
  extras: readonly RealThirdPartySpec[];
} = {
  core: {
    npm: "graphql",
    version: "16.11.0",
    marker: "LAB_3P_REAL_CORE",
    sideEffectImport: `import { Kind } from "graphql";
(globalThis as typeof globalThis & { __LAB_3P_REAL__?: string }).__LAB_3P_REAL__ =
  Kind.NAME + ":LAB_3P_REAL_CORE";
`,
  },
  extras: [
    {
      npm: "dataloader",
      version: "2.2.3",
      marker: "LAB_3P_REAL_EXTRA_0",
      sideEffectImport: `import DataLoader from "dataloader";
(globalThis as typeof globalThis & { __LAB_3P_REAL__?: string }).__LAB_3P_REAL__ =
  String(DataLoader.name) + ":LAB_3P_REAL_EXTRA_0";
`,
    },
    {
      npm: "graphql-tag",
      version: "2.12.6",
      marker: "LAB_3P_REAL_EXTRA_1",
      sideEffectImport: `import gql from "graphql-tag";
(globalThis as typeof globalThis & { __LAB_3P_REAL__?: string }).__LAB_3P_REAL__ =
  String(gql.name ?? "gql") + ":LAB_3P_REAL_EXTRA_1";
`,
    },
    {
      npm: "uuid",
      version: "11.1.0",
      marker: "LAB_3P_REAL_EXTRA_2",
      sideEffectImport: `import { v4 as uuidv4 } from "uuid";
(globalThis as typeof globalThis & { __LAB_3P_REAL__?: string }).__LAB_3P_REAL__ =
  uuidv4.length + ":LAB_3P_REAL_EXTRA_2";
`,
    },
  ],
};

export function parseThirdPartyConfig(args: {
  count?: number;
  bytesPerPackage?: number;
  smoke?: boolean;
  mode?: string;
}): ThirdPartyConfig {
  const base = args.smoke ? SMOKE_THIRD_PARTY : DEFAULT_THIRD_PARTY;
  const modeRaw = args.mode ?? base.mode;
  if (modeRaw !== "stub" && modeRaw !== "real") {
    throw new Error("Invalid --3p (stub|real)");
  }
  const mode: ThirdPartyMode = modeRaw;
  const count = args.count ?? base.count;
  const bytesPerPackage = args.bytesPerPackage ?? base.bytesPerPackage;
  if (!Number.isFinite(count) || count < 1 || count > 32 || !Number.isInteger(count)) {
    throw new Error("Invalid --3p-count (1..32)");
  }
  if (mode === "real" && count > 1 + REAL_THIRD_PARTY_PACKAGES.extras.length) {
    throw new Error(
      `Invalid --3p-count for real mode (1..${1 + REAL_THIRD_PARTY_PACKAGES.extras.length})`,
    );
  }
  if (
    !Number.isFinite(bytesPerPackage) ||
    bytesPerPackage < 64 ||
    bytesPerPackage > 2_000_000
  ) {
    throw new Error("Invalid --3p-bytes (64..2000000)");
  }
  return { count, bytesPerPackage, mode };
}

export type ColdStartArmMetrics = {
  importMs: number;
  rssBytes: number;
  heapUsedBytes: number;
};

export type ColdStartBenefit = {
  importMsSaved: number;
  rssBytesSaved: number;
  importMsSavedPct: number;
  rssBytesSavedPct: number;
};

export function coldStartBenefit(
  singleton: ColdStartArmMetrics,
  esm: ColdStartArmMetrics,
): ColdStartBenefit {
  const importMsSaved = Number(
    Math.max(0, singleton.importMs - esm.importMs).toFixed(2),
  );
  const rssBytesSaved = Math.max(0, singleton.rssBytes - esm.rssBytes);
  const importMsSavedPct =
    singleton.importMs === 0
      ? 0
      : Number(((importMsSaved / singleton.importMs) * 100).toFixed(1));
  const rssBytesSavedPct =
    singleton.rssBytes === 0
      ? 0
      : Number(((rssBytesSaved / singleton.rssBytes) * 100).toFixed(1));
  return {
    importMsSaved,
    rssBytesSaved,
    importMsSavedPct,
    rssBytesSavedPct,
  };
}

export function isBenchCase(value: string): value is BenchCase {
  return (BENCH_CASES as readonly string[]).includes(value);
}

/** Per-arm pipeline timings under one cache mode (warm or cold). */
export type PipelineArmTimings = {
  generateMs: number;
  installMs: number;
  bundleMs: number;
  artifactBytes: number;
  /** Null when not uploaded (local) or upload not measured. */
  artifactUploadMs: number | null;
  pipelineTotalMs: number;
};

export type PipelineCacheMode = "warm" | "cold";

export type PipelineModeArms = {
  singleton: PipelineArmTimings;
  esm: PipelineArmTimings;
};

/** Realistic pipeline: fair pairs per cache mode; never average warm+cold. */
export type PipelineReport = {
  warm: PipelineModeArms | null;
  cold: PipelineModeArms | null;
};

export type ProofRunner = "github-actions" | "local";

export type RealisticProof = {
  timestamp: string;
  githubRunUrl: string | null;
  githubRunId: string | null;
  runner: ProofRunner;
};

export type RequestLatency = {
  p50: number;
  p95: number;
};

export type RequestArmMetrics = {
  warmup: number;
  measured: number;
  concurrency: number;
  latencyMs: RequestLatency;
  cpuUserMs: number;
  cpuSystemMs: number;
  rssBytes: number;
  heapUsedBytes: number;
};

/** Filled once per arm (not × warm/cold). Null until request harness runs. */
export type RequestReport = {
  singleton: RequestArmMetrics;
  esm: RequestArmMetrics;
  disclaimer: string;
} | null;

export const REQUEST_DISCLAIMER =
  "Fresh Node process per arm (isolated RSS/heap). Node HTTP on GitHub Actions / local is not a Cloudflare isolate boot and is not production gateway RPS. Relative arm comparison only.";

export const REQUEST_BENCH_DEFAULTS = {
  warmup: 50,
  measured: 1000,
  concurrency: 1,
} as const;

export const REALISTIC_PIPELINE_METHODOLOGY =
  "Compare fair pairs only (singleton vs ESM within the same cache mode). Never average warm and cold into one score. Cold wipes node_modules + the Bun install cache before the timed bun install; warm leaves them in place. Artifact byte/upload timings are a CI proxy — not a Cloudflare Workers deploy.";

export function pipelineTotalMs(parts: {
  generateMs: number;
  installMs: number;
  bundleMs: number;
  artifactUploadMs: number | null;
}): number {
  return (
    parts.generateMs +
    parts.installMs +
    parts.bundleMs +
    (parts.artifactUploadMs ?? 0)
  );
}

export function buildPipelineArmTimings(parts: {
  generateMs: number;
  installMs: number;
  bundleMs: number;
  artifactBytes: number;
  artifactUploadMs: number | null;
}): PipelineArmTimings {
  return {
    generateMs: parts.generateMs,
    installMs: parts.installMs,
    bundleMs: parts.bundleMs,
    artifactBytes: parts.artifactBytes,
    artifactUploadMs: parts.artifactUploadMs,
    pipelineTotalMs: pipelineTotalMs(parts),
  };
}

export function mergePipelineReport(
  existing: PipelineReport | null | undefined,
  mode: PipelineCacheMode,
  arms: PipelineModeArms,
): PipelineReport {
  const base: PipelineReport = {
    warm: existing?.warm ?? null,
    cold: existing?.cold ?? null,
  };
  return mode === "warm"
    ? { ...base, warm: arms }
    : { ...base, cold: arms };
}

export function buildProofFromEnv(
  env: Record<string, string | undefined>,
  timestamp: string = new Date().toISOString(),
): RealisticProof {
  const runId = env.GITHUB_RUN_ID ?? null;
  const isActions =
    env.GITHUB_ACTIONS === "true" || env.GITHUB_ACTIONS === "1";
  if (!isActions || runId == null || runId === "") {
    return {
      timestamp,
      githubRunUrl: null,
      githubRunId: null,
      runner: "local",
    };
  }
  const server = env.GITHUB_SERVER_URL ?? "https://github.com";
  const repo = env.GITHUB_REPOSITORY ?? "";
  const githubRunUrl =
    repo !== ""
      ? `${server.replace(/\/$/, "")}/${repo}/actions/runs/${runId}`
      : null;
  return {
    timestamp,
    githubRunUrl,
    githubRunId: runId,
    runner: "github-actions",
  };
}

/**
 * Percentile of a pre-sorted ascending numeric sample (linear interpolation).
 * Empty → 0; single sample → that value.
 */
export function percentile(
  sortedAscending: readonly number[],
  p: number,
): number {
  if (sortedAscending.length === 0) return 0;
  if (sortedAscending.length === 1) return sortedAscending[0]!;
  const rank = (p / 100) * (sortedAscending.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const w = rank - lo;
  return Number(
    ((1 - w) * sortedAscending[lo]! + w * sortedAscending[hi]!).toFixed(2),
  );
}

export function buildRequestArmMetrics(input: {
  latenciesMs: readonly number[];
  warmup: number;
  measured: number;
  concurrency: number;
  cpuUserMs: number;
  cpuSystemMs: number;
  rssBytes: number;
  heapUsedBytes: number;
}): RequestArmMetrics {
  const sorted = [...input.latenciesMs].sort((a, b) => a - b);
  return {
    warmup: input.warmup,
    measured: input.measured,
    concurrency: input.concurrency,
    latencyMs: {
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
    },
    cpuUserMs: input.cpuUserMs,
    cpuSystemMs: input.cpuSystemMs,
    rssBytes: input.rssBytes,
    heapUsedBytes: input.heapUsedBytes,
  };
}
