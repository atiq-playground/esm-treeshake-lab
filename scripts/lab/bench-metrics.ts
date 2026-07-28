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
  | "coldstart";

export const BENCH_CASES: readonly BenchCase[] = [
  "baseline",
  "wide",
  "cycles",
  "partial",
  "thirdparty",
  "fleet",
  "coldstart",
] as const;

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
  }
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
