/**
 * Scale bench: esbuild singleton vs ESM, write report artifacts.
 *
 *   bun run scripts/lab/run-scale-bench.ts --smoke
 *   bun run scripts/lab/run-scale-bench.ts --n=100 --used=200
 *   bun run scripts/lab/run-scale-bench.ts --case=wide --n=100 --used=300
 *   bun run scripts/lab/run-scale-bench.ts --case=cycles --n=100 --used=300
 *   bun run scripts/lab/run-scale-bench.ts --case=partial --n=100 --used=500
 *   bun run scripts/lab/run-scale-bench.ts --case=thirdparty --n=100
 *   bun run scripts/lab/run-scale-bench.ts --case=thirdparty --n=100 --3p=real
 *   bun run scripts/lab/run-scale-bench.ts --case=fleet --n=50 --consumers=100
 *   bun run scripts/lab/run-scale-bench.ts --case=fleet --n=3 --consumers=10 --fleet-mode=both
 */
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import * as esbuild from "esbuild";
import {
  isBenchCase,
  parseFleetMode,
  parseThirdPartyConfig,
  reportArtifactBase,
  scaleFleetMetrics,
  sharingSavingsPct,
  sumOutputBytes,
  type BenchCase,
  type FleetMode,
  type ThirdPartyConfig,
} from "./bench-metrics.ts";
import { byteParts, formatBytesDetail } from "./format-bytes.ts";
import {
  resolveThirdPartyPackage,
  TP_CORE_MARKER,
  tpExtraCount,
  tpExtraMarker,
} from "./third-party-stubs.ts";

const ROOT = join(import.meta.dir, "../..");
const OUT_DIR = join(ROOT, "tmp/lab-bench");
const DOCS_LAB = join(ROOT, "docs/lab");
const FIXTURE_GEN = join(ROOT, "scripts/lab/fixtures/.generated");

function argValue(flag: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit?.slice(flag.length + 1);
}

const smoke = process.argv.includes("--smoke");
const caseRaw = argValue("--case") ?? "baseline";
if (!isBenchCase(caseRaw)) {
  console.error(
    "Invalid --case (baseline|wide|cycles|partial|thirdparty|fleet)",
  );
  process.exit(2);
}
if (smoke && (caseRaw === "thirdparty" || caseRaw === "fleet" || caseRaw === "coldstart")) {
  console.error(
    "UC1 --smoke cannot run thirdparty/fleet/coldstart. Use --case=… --n=3 (generated), or lab:bench:coldstart.",
  );
  process.exit(2);
}
const benchCase: BenchCase = smoke ? "baseline" : caseRaw;

const nFlag = argValue("--n");
const n = smoke ? 3 : Number(nFlag ?? (benchCase === "fleet" ? "50" : "100"));
const mode = smoke ? "smoke" : "generated";

const fnsFlag = argValue("--fns");
const usedFlag = argValue("--used");
const seedFlag = argValue("--seed");
const cyclesFlag = process.argv.includes("--cycles");
const consumersFlag = argValue("--consumers");

let fns: number;
let cycles: boolean;
let thirdParty: ThirdPartyConfig | null = null;
if (smoke || benchCase === "baseline" || benchCase === "fleet") {
  fns = 2;
  cycles = false;
} else if (benchCase === "thirdparty") {
  fns = Number(fnsFlag ?? "2");
  cycles = false;
  try {
    const modeFlag = argValue("--3p");
    thirdParty = parseThirdPartyConfig({
      mode:
        modeFlag === "real" || modeFlag === "stub" ? modeFlag : "stub",
      count:
        argValue("--3p-count") != null
          ? Number(argValue("--3p-count"))
          : undefined,
      bytesPerPackage:
        argValue("--3p-bytes") != null
          ? Number(argValue("--3p-bytes"))
          : undefined,
    });
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(2);
  }
} else if (benchCase === "wide" || benchCase === "partial") {
  fns = Number(fnsFlag ?? "20");
  cycles = false;
} else if (benchCase === "coldstart") {
  console.error("Use bun run lab:bench:coldstart (separate harness).");
  process.exit(2);
} else {
  // cycles
  fns = Number(fnsFlag ?? "20");
  cycles = true;
}
if (cyclesFlag && (benchCase === "baseline" || benchCase === "partial" || benchCase === "thirdparty" || benchCase === "fleet")) {
  console.error("Cycles only via --case=cycles");
  process.exit(2);
}
if (!Number.isFinite(fns) || fns < 2 || fns > 200) {
  console.error("Invalid --fns (2..200)");
  process.exit(2);
}

const consumersDefault = benchCase === "fleet" ? 100 : 1;
const consumers =
  consumersFlag != null ? Number(consumersFlag) : consumersDefault;
if (
  !Number.isFinite(consumers) ||
  !Number.isInteger(consumers) ||
  consumers < 1 ||
  consumers > 100_000
) {
  console.error("Invalid --consumers (1..100000)");
  process.exit(2);
}
if (benchCase !== "fleet" && consumersFlag != null && consumers !== 1) {
  console.error("--consumers>1 only with --case=fleet");
  process.exit(2);
}

let fleetMode: FleetMode = "both";
if (benchCase === "fleet") {
  try {
    fleetMode = parseFleetMode(argValue("--fleet-mode"));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(2);
  }
} else if (argValue("--fleet-mode") != null) {
  console.error("--fleet-mode only with --case=fleet");
  process.exit(2);
}

const surfaceFns = n * fns;

/** How many surface functions the app binds (same on both arms). May exceed N. */
let callSites: number;
if (usedFlag != null) {
  callSites = Number(usedFlag);
} else if (benchCase === "partial") {
  callSites = Math.max(1, Math.floor(n / 2));
} else {
  callSites = 1;
}
if (!Number.isFinite(callSites) || callSites < 1 || callSites > surfaceFns) {
  console.error(`Invalid --used (1..${surfaceFns} surface fns)`);
  process.exit(2);
}
/** Multi-import fixtures whenever the app binds more than svc-0.used. */
const multiCall = callSites > 1 || benchCase === "partial";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type BoundSite =
  | { pkg: number; kind: "used"; name: string }
  | { pkg: number; kind: "unused"; name: string; unusedIndex: number };

function fnNameForSlot(slot: number, totalFns: number): string {
  if (slot === 0) return "used";
  if (totalFns === 2) return "unused";
  return `unused_${slot}`;
}

/** Bind K surface fns: fill `used` across packages, then unused_1, … (optional shuffle). */
function pickBoundSites(
  total: number,
  totalFns: number,
  k: number,
  seed: number | null,
): BoundSite[] {
  const surface: BoundSite[] = [];
  for (let slot = 0; slot < totalFns; slot++) {
    for (let pkg = 0; pkg < total; pkg++) {
      const name = fnNameForSlot(slot, totalFns);
      if (slot === 0) surface.push({ pkg, kind: "used", name });
      else surface.push({ pkg, kind: "unused", name, unusedIndex: slot });
    }
  }
  if (seed != null) {
    const rand = mulberry32(seed);
    for (let i = surface.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = surface[i]!;
      surface[i] = surface[j]!;
      surface[j] = tmp;
    }
  }
  return surface.slice(0, k).sort((a, b) =>
    a.pkg === b.pkg
      ? a.kind === b.kind
        ? a.name.localeCompare(b.name)
        : a.kind === "used"
          ? -1
          : 1
      : a.pkg - b.pkg,
  );
}

const seed =
  seedFlag != null && seedFlag !== ""
    ? Number(seedFlag)
    : null;
if (seed != null && !Number.isFinite(seed)) {
  console.error("Invalid --seed");
  process.exit(2);
}

const boundSites = pickBoundSites(n, fns, callSites, seed);
const usedPackageIds = [...new Set(boundSites.map((s) => s.pkg))].sort(
  (a, b) => a - b,
);
const expectedUsedMarkers = boundSites.filter((s) => s.kind === "used").length;
const expectedBoundUnusedMarkers = boundSites.filter(
  (s) => s.kind === "unused",
).length;

const reportBase = reportArtifactBase(benchCase, {
  thirdPartyMode: thirdParty?.mode,
});

const pkgPrefix = smoke
  ? { singleton: "@lab/smoke-singleton-svc", esm: "@lab/smoke-esm-svc", register: "@lab/smoke-singleton-register" }
  : { singleton: "@lab/singleton-svc", esm: "@lab/esm-svc", register: "@lab/singleton-register" };

function writeMultiCallFixtures(): { esm: string; singleton: string } {
  mkdirSync(FIXTURE_GEN, { recursive: true });
  const tag = benchCase;
  const byPkg = new Map<number, BoundSite[]>();
  for (const site of boundSites) {
    const list = byPkg.get(site.pkg) ?? [];
    list.push(site);
    byPkg.set(site.pkg, list);
  }
  const pkgIds = [...byPkg.keys()].sort((a, b) => a - b);

  const esmImports = pkgIds
    .map((pkg) => {
      const sites = byPkg.get(pkg)!;
      const specs = sites
        .map((s, idx) => `${s.name} as fn_${pkg}_${idx}`)
        .join(", ");
      return `import { ${specs} } from "${pkgPrefix.esm}-${pkg}";`;
    })
    .join("\n");
  const esmCalls = pkgIds
    .flatMap((pkg) =>
      (byPkg.get(pkg) ?? []).map((_, idx) => `fn_${pkg}_${idx}()`),
    )
    .join(", ");
  const esmPath = join(FIXTURE_GEN, `esm-entry.${tag}.ts`);
  writeFileSync(
    esmPath,
    `${esmImports}\n\nexport const result = [${esmCalls}].join("|");\n`,
  );

  const singletonImports = [
    `import { registerPublicServices } from "${pkgPrefix.register}";`,
    ...pkgIds.map(
      (pkg) =>
        `import { Svc${pkg}Service } from "${pkgPrefix.singleton}-${pkg}";`,
    ),
  ].join("\n");
  const singletonCalls = pkgIds
    .flatMap((pkg) =>
      (byPkg.get(pkg) ?? []).map((s) => `Svc${pkg}Service.${s.name}()`),
    )
    .join(", ");
  const singletonPath = join(FIXTURE_GEN, `singleton-entry.${tag}.ts`);
  writeFileSync(
    singletonPath,
    `${singletonImports}

registerPublicServices({ baseUrl: "http://lab.invalid" });
export const result = [${singletonCalls}].join("|");
`,
  );
  return { esm: esmPath, singleton: singletonPath };
}

if (!smoke) {
  const genCase =
    benchCase === "fleet"
      ? "baseline"
      : benchCase === "thirdparty"
        ? "thirdparty"
        : benchCase;
  const genArgs = [
    "run",
    "scripts/lab/generate-scale-bench.ts",
    `--n=${n}`,
    `--fns=${fns}`,
    `--case=${genCase}`,
  ];
  if (cycles) genArgs.push("--cycles");
  if (thirdParty) {
    genArgs.push(`--3p=${thirdParty.mode}`);
    genArgs.push(`--3p-count=${thirdParty.count}`);
    genArgs.push(`--3p-bytes=${thirdParty.bytesPerPackage}`);
  }
  const gen = spawnSync("bun", genArgs, { cwd: ROOT, stdio: "inherit" });
  if (gen.status !== 0) process.exit(gen.status ?? 1);
  const install = spawnSync("bun", ["install"], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (install.status !== 0) process.exit(install.status ?? 1);
}

const fixturePaths = multiCall
  ? writeMultiCallFixtures()
  : {
      esm: join(ROOT, `scripts/lab/fixtures/esm-entry.${mode}.ts`),
      singleton: join(
        ROOT,
        `scripts/lab/fixtures/singleton-entry.${mode}.ts`,
      ),
    };

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(DOCS_LAB, { recursive: true });

type ArmMetrics = {
  bytes: number;
  buildMs: number;
  markersUsedPresent: number;
  markersUnusedRetained: number;
  markersUnusedTotal: number;
  /** Stub 3p markers retained (LAB_3P_CORE / LAB_3P_EXTRA_*). */
  thirdPartyMarkersRetained: number;
};

function countThirdPartyMarkers(code: string): number {
  if (thirdParty?.mode === "real") {
    const hits = code.match(/LAB_3P_REAL_(?:CORE|EXTRA_\d+)/g) ?? [];
    return new Set(hits).size;
  }
  const hits = code.match(/LAB_3P_(?:CORE|EXTRA_\d+)/g) ?? [];
  return new Set(hits).size;
}

/** Bun workspace links are not always visible to esbuild: map @lab/* to source. */
function resolveLabPackage(specifier: string): string | undefined {
  if (specifier === "@lab/singleton-services") {
    return join(ROOT, "packages/lab/singleton-services/src/index.ts");
  }
  if (specifier === "@lab/smoke-singleton-register") {
    return join(ROOT, "packages/lab/smoke/singleton-register/src/index.ts");
  }
  if (specifier === "@lab/singleton-register") {
    return join(ROOT, "packages/lab/generated/singleton/register/src/index.ts");
  }
  const tp = resolveThirdPartyPackage(ROOT, specifier, "generated");
  if (tp) return tp;
  let m = /^@lab\/smoke-singleton-svc-(\d+)$/.exec(specifier);
  if (m) {
    return join(ROOT, `packages/lab/smoke/singleton/svc-${m[1]}/src/index.ts`);
  }
  m = /^@lab\/smoke-esm-svc-(\d+)$/.exec(specifier);
  if (m) {
    return join(ROOT, `packages/lab/smoke/esm/svc-${m[1]}/src/index.ts`);
  }
  m = /^@lab\/singleton-svc-(\d+)$/.exec(specifier);
  if (m) {
    return join(ROOT, `packages/lab/generated/singleton/svc-${m[1]}/src/index.ts`);
  }
  m = /^@lab\/esm-svc-(\d+)$/.exec(specifier);
  if (m) {
    return join(ROOT, `packages/lab/generated/esm/svc-${m[1]}/src/index.ts`);
  }
  return undefined;
}

const labResolvePlugin: esbuild.Plugin = {
  name: "lab-resolve",
  setup(build) {
    build.onResolve({ filter: /^@lab\// }, (args) => {
      const path = resolveLabPackage(args.path);
      if (!path || !existsSync(path)) {
        return { errors: [{ text: `Cannot resolve ${args.path}` }] };
      }
      return { path };
    });
  },
};

async function bundleArm(
  arm: "singleton" | "esm",
): Promise<{ metrics: ArmMetrics; outfile: string }> {
  const entry = arm === "esm" ? fixturePaths.esm : fixturePaths.singleton;
  const outfile = join(OUT_DIR, `${arm}-${benchCase}.js`);
  const t0 = performance.now();
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    outfile,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    // Real npm CJS packages (graphql-tag, dataloader) need main under neutral.
    mainFields: ["module", "main"],
    conditions: ["import", "module", "default"],
    write: true,
    logLevel: "silent",
    plugins: [labResolvePlugin],
    absWorkingDir: ROOT,
  });
  const buildMs = Math.round(performance.now() - t0);
  const code = readFileSync(outfile, "utf8");
  const bytes = Buffer.byteLength(code, "utf8");

  const usedRe =
    arm === "singleton"
      ? /EXECUTING_LAB_SINGLETON_SVC_\d+_USED/g
      : /EXECUTING_LAB_ESM_SVC_\d+_USED/g;
  const unusedRe =
    arm === "singleton"
      ? /EXECUTING_LAB_SINGLETON_SVC_\d+_UNUSED(?:_\d+)?/g
      : /EXECUTING_LAB_ESM_SVC_\d+_UNUSED(?:_\d+)?/g;

  const markersUsedPresent = new Set(code.match(usedRe) ?? []).size;
  const unusedHits = code.match(unusedRe) ?? [];
  const markersUnusedRetained = new Set(unusedHits).size;
  const unusedPerSvc = fns - 1;
  const packagesInGraph =
    arm === "singleton" ? n : cycles ? n : usedPackageIds.length;
  const markersUnusedTotal = packagesInGraph * unusedPerSvc;
  const thirdPartyMarkersRetained = countThirdPartyMarkers(code);

  return {
    outfile,
    metrics: {
      bytes,
      buildMs,
      markersUsedPresent,
      markersUnusedRetained,
      markersUnusedTotal,
      thirdPartyMarkersRetained,
    },
  };
}

const singleton = await bundleArm("singleton");
const esm = await bundleArm("esm");

const bytesSavedPct =
  singleton.metrics.bytes === 0
    ? 0
    : Number(
        (
          ((singleton.metrics.bytes - esm.metrics.bytes) /
            singleton.metrics.bytes) *
          100
        ).toFixed(1),
      );
const unusedMarkersDelta =
  singleton.metrics.markersUnusedRetained - esm.metrics.markersUnusedRetained;
const bytesSavedAbs = Math.max(
  0,
  singleton.metrics.bytes - esm.metrics.bytes,
);
const singletonSize = byteParts(singleton.metrics.bytes);
const esmSize = byteParts(esm.metrics.bytes);
const savedSize = byteParts(bytesSavedAbs);

const esmOfSingletonPct =
  singleton.metrics.bytes === 0
    ? 0
    : Number(
        ((esm.metrics.bytes / singleton.metrics.bytes) * 100).toFixed(2),
      );
const singletonVsEsmFactor =
  esm.metrics.bytes === 0
    ? 0
    : Number((singleton.metrics.bytes / esm.metrics.bytes).toFixed(1));
const callSiteCoveragePct = Number(
  ((callSites / surfaceFns) * 100).toFixed(2),
);
const unusedRemovedPct =
  singleton.metrics.markersUnusedRetained === 0
    ? 100
    : Number(
        (
          (unusedMarkersDelta / singleton.metrics.markersUnusedRetained) *
          100
        ).toFixed(1),
      );

const fleetNaive =
  benchCase === "fleet" && (fleetMode === "naive" || fleetMode === "both")
    ? scaleFleetMetrics(
        {
          singletonBytes: singleton.metrics.bytes,
          esmBytes: esm.metrics.bytes,
          bytesSaved: bytesSavedAbs,
        },
        consumers,
      )
    : null;

async function bundleFleetShared(
  arm: "singleton" | "esm",
): Promise<{ bytes: number; buildMs: number; chunkCount: number }> {
  const fleetDir = join(OUT_DIR, `fleet-shared-${arm}`);
  const entriesDir = join(FIXTURE_GEN, `fleet-entries-${arm}`);
  rmSync(fleetDir, { recursive: true, force: true });
  rmSync(entriesDir, { recursive: true, force: true });
  mkdirSync(entriesDir, { recursive: true });
  mkdirSync(fleetDir, { recursive: true });

  const entryPoints: string[] = [];
  for (let i = 0; i < consumers; i++) {
    const path = join(entriesDir, `consumer-${i}.ts`);
    const src =
      arm === "esm"
        ? `import { used } from "${pkgPrefix.esm}-0";\nexport const result_${i} = used();\n`
        : `import { registerPublicServices } from "${pkgPrefix.register}";
import { Svc0Service } from "${pkgPrefix.singleton}-0";
registerPublicServices({ baseUrl: "http://lab.invalid" });
export const result_${i} = Svc0Service.used();
`;
    writeFileSync(path, src);
    entryPoints.push(path);
  }

  const t0 = performance.now();
  await esbuild.build({
    entryPoints,
    bundle: true,
    outdir: fleetDir,
    format: "esm",
    splitting: true,
    platform: "neutral",
    target: "es2022",
    mainFields: ["module", "main"],
    conditions: ["import", "module", "default"],
    write: true,
    logLevel: "silent",
    plugins: [labResolvePlugin],
    absWorkingDir: ROOT,
  });
  const buildMs = Math.round(performance.now() - t0);
  const files = readdirSync(fleetDir).filter((f) => f.endsWith(".js"));
  const lengths = files.map((f) =>
    Buffer.byteLength(readFileSync(join(fleetDir, f), "utf8"), "utf8"),
  );
  return {
    bytes: sumOutputBytes(lengths),
    buildMs,
    chunkCount: files.length,
  };
}

const fleetShared =
  benchCase === "fleet" && (fleetMode === "shared" || fleetMode === "both")
    ? {
        singleton: await bundleFleetShared("singleton"),
        esm: await bundleFleetShared("esm"),
      }
    : null;

const fleetSharedTotals =
  fleetShared != null
    ? (() => {
        const singletonBytes = fleetShared.singleton.bytes;
        const esmBytes = fleetShared.esm.bytes;
        const bytesSaved = Math.max(0, singletonBytes - esmBytes);
        const bytesSavedPct =
          singletonBytes === 0
            ? 0
            : Number(((bytesSaved / singletonBytes) * 100).toFixed(1));
        const singletonVsEsmFactor =
          esmBytes === 0
            ? 0
            : Number((singletonBytes / esmBytes).toFixed(1));
        return {
          consumers,
          singletonBytes,
          esmBytes,
          bytesSaved,
          bytesSavedPct,
          singletonVsEsmFactor,
          singletonChunkCount: fleetShared.singleton.chunkCount,
          esmChunkCount: fleetShared.esm.chunkCount,
          singletonBuildMs: fleetShared.singleton.buildMs,
          esmBuildMs: fleetShared.esm.buildMs,
        };
      })()
    : null;

/** Primary fleet totals for Quick Facts: prefer naive (deploy-per-app story). */
const fleet = fleetNaive ?? fleetSharedTotals;
const fleetSingletonSize = fleet ? byteParts(fleet.singletonBytes) : null;
const fleetEsmSize = fleet ? byteParts(fleet.esmBytes) : null;
const fleetSavedSize = fleet ? byteParts(fleet.bytesSaved) : null;
const sharedVsNaivePct =
  fleetNaive && fleetSharedTotals
    ? sharingSavingsPct(
        fleetNaive.singletonBytes,
        fleetSharedTotals.singletonBytes,
      )
    : null;

const expectedTpSingleton = thirdParty
  ? 1 + tpExtraCount(thirdParty)
  : 0;
const expectedTpEsm = thirdParty ? 1 : 0; // shared core only

function caseNote(): string {
  if (benchCase === "thirdparty" && thirdParty) {
    if (thirdParty.mode === "real") {
      return (
        `Third-party ballast (real pinned npm): every domain package side-effect-imports @lab/3p-core → graphql; ` +
        `the singleton register also imports ${tpExtraCount(thirdParty)} unused extras ` +
        `(dataloader / graphql-tag / uuid wrappers). Shared core is paid on both arms; unused extras stay singleton-only. ` +
        `Versions pinned in package.json/lockfile for CI reproducibility.`
      );
    }
    return (
      `Third-party ballast (stubs, not real npm): every domain package side-effect-imports @lab/3p-core; ` +
      `the singleton register also imports ${tpExtraCount(thirdParty)} unused @lab/3p-extra-* modules ` +
      `(~${thirdParty.bytesPerPackage} B ballast each). Shared core is paid on both arms; unused extras stay singleton-only. ` +
      `Use --3p=real for pinned graphql-stack npm weight.`
    );
  }
  if (benchCase === "fleet" && fleet) {
    const sharedBit =
      fleetSharedTotals != null
        ? ` Also measured: one esbuild multi-entry (splitting) across M entries so shared modules are not naively ×M` +
          (sharedVsNaivePct != null
            ? ` (singleton shared saves ${sharedVsNaivePct}% vs naive ×M).`
            : ".")
        : "";
    return (
      `Multi-consumer / non-GraphQL framing: ${consumers} identical frontend apps (or services). ` +
      (fleetNaive
        ? `Naive fleet totals = per-consumer × M (each app pays the graph again).`
        : `Shared multi-entry totals only (--fleet-mode=shared).`) +
      sharedBit +
      ` Story is React/SDK consumers, not GraphQL resolvers.`
    );
  }
  if (multiCall) {
    return `App binds ${callSites} of ${surfaceFns} surface functions across ${usedPackageIds.length} packages. Both arms call the same ${callSites} sites; singleton still registers all ${n} packages${cycles ? " (cycles may still drag the full ring into ESM)" : ""}.`;
  }
  return `ESM call sites: 1 (import { used } from svc-0 only). Surface still ${surfaceFns} fns across ${n} packages; --fns only grows what can be shaken, not what ESM calls.`;
}

const report = {
  version: 1 as const,
  timestamp: new Date().toISOString(),
  case: benchCase,
  n,
  fns,
  cycles,
  callSites,
  usedPackageIds,
  seed,
  surfaceFns,
  consumers: benchCase === "fleet" ? consumers : 1,
  fleetMode: benchCase === "fleet" ? fleetMode : undefined,
  thirdParty,
  host: "esbuild" as const,
  mode,
  note: caseNote(),
  arms: {
    singleton: {
      ...singleton.metrics,
      size: singletonSize,
    },
    esm: {
      ...esm.metrics,
      size: esmSize,
    },
  },
  benefit: {
    bytesSavedPct,
    bytesSaved: bytesSavedAbs,
    sizeSaved: savedSize,
    unusedMarkersDelta,
    /** ESM size as % of singleton (lower is better for ESM). */
    esmOfSingletonPct,
    /** How many times larger singleton is vs ESM. */
    singletonVsEsmFactor,
    /** Call sites / full surface (partial story). */
    callSiteCoveragePct,
    /** % of singleton unused markers dropped by ESM. */
    unusedRemovedPct,
  },
  fleet: fleet
    ? {
        ...fleet,
        mode: fleetMode,
        singletonSize: fleetSingletonSize,
        esmSize: fleetEsmSize,
        sizeSaved: fleetSavedSize,
        naive: fleetNaive
          ? {
              ...fleetNaive,
              singletonSize: byteParts(fleetNaive.singletonBytes),
              esmSize: byteParts(fleetNaive.esmBytes),
              sizeSaved: byteParts(fleetNaive.bytesSaved),
            }
          : undefined,
        shared: fleetSharedTotals
          ? {
              ...fleetSharedTotals,
              singletonSize: byteParts(fleetSharedTotals.singletonBytes),
              esmSize: byteParts(fleetSharedTotals.esmBytes),
              sizeSaved: byteParts(fleetSharedTotals.bytesSaved),
            }
          : undefined,
        sharingSavingsPct: sharedVsNaivePct ?? undefined,
      }
    : undefined,
  methodologyLimits:
    benchCase === "thirdparty"
      ? thirdParty?.mode === "real"
        ? "Real npm path pins graphql + dataloader + graphql-tag + uuid. esbuild bundles their reachable graphs; CJS interop and peer trees still differ from production Workers installs. Stub path remains default for byte-floor CI."
        : "3p packages are generated stubs with fixed ballast + side-effect touches. They approximate unused SDK weight. Pass --3p=real for pinned npm graphql-stack weight."
      : benchCase === "fleet"
        ? "Naive fleet totals multiply one measured consumer graph by M. Shared mode bundles M esbuild entries with code-splitting so common modules are counted once. Ignores CDN caches and per-app bind differences. Not a Workers isolate boot."
        : undefined,
};

const publishLatest = !smoke && n > 3;
const jsonPath = publishLatest
  ? join(DOCS_LAB, `${reportBase}.json`)
  : join(OUT_DIR, `${reportBase}.json`);
const mdPath = publishLatest
  ? join(DOCS_LAB, `${reportBase}.md`)
  : join(OUT_DIR, `${reportBase}.md`);

writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");

const tpSection =
  thirdParty != null
    ? `
## Third-party (${thirdParty.mode})

| | Count | ${thirdParty.mode === "stub" ? "Bytes/pkg (ballast)" : "Mode"} | Markers in singleton | Markers in ESM |
|--|------:|--------------------:|---------------------:|---------------:|
| Config | ${thirdParty.count} | ${thirdParty.mode === "stub" ? thirdParty.bytesPerPackage.toLocaleString("en-US") : "real npm"} | ${singleton.metrics.thirdPartyMarkersRetained} | ${esm.metrics.thirdPartyMarkersRetained} |

- Shared core marker: \`${thirdParty.mode === "real" ? "LAB_3P_REAL_CORE" : TP_CORE_MARKER}\` (both arms when any domain pkg is imported)
- Unused extras: ${
        thirdParty.mode === "real"
          ? Array.from(
              { length: tpExtraCount(thirdParty) },
              (_, i) => `\`LAB_3P_REAL_EXTRA_${i}\``,
            ).join(", ") || "(none)"
          : Array.from(
              { length: tpExtraCount(thirdParty) },
              (_, i) => `\`${tpExtraMarker(i)}\``,
            ).join(", ") || "(none)"
      } (singleton register only)
`
    : "";

const fleetSharedSize = fleetSharedTotals
  ? {
      singleton: byteParts(fleetSharedTotals.singletonBytes),
      esm: byteParts(fleetSharedTotals.esmBytes),
      saved: byteParts(fleetSharedTotals.bytesSaved),
    }
  : null;

const fleetSection =
  fleet && fleetSingletonSize && fleetEsmSize && fleetSavedSize
    ? `
## Fleet (×${consumers} consumers, mode=${fleetMode})

${
  fleetNaive
    ? `| | Per consumer | Naive ×${consumers} |
|--|-------------:|--------------------------:|
| Singleton | ${singletonSize.detail} | ${byteParts(fleetNaive.singletonBytes).detail} |
| ESM | ${esmSize.detail} | ${byteParts(fleetNaive.esmBytes).detail} |
| Saved | ${savedSize.detail} (${bytesSavedPct}%) | ${byteParts(fleetNaive.bytesSaved).detail} (${fleetNaive.bytesSavedPct}%) |
`
    : ""
}${
  fleetSharedSize
    ? `
### Shared multi-entry (esbuild splitting)

| | Multi-entry total | Chunks |
|--|------------------:|-------:|
| Singleton | ${fleetSharedSize.singleton.detail} | ${fleetSharedTotals!.singletonChunkCount} |
| ESM | ${fleetSharedSize.esm.detail} | ${fleetSharedTotals!.esmChunkCount} |
| Saved | ${fleetSharedSize.saved.detail} (${fleetSharedTotals!.bytesSavedPct}%) | |
${sharedVsNaivePct != null ? `\nNaive→shared singleton savings: **${sharedVsNaivePct}%** (shared modules counted once).\n` : ""}`
    : ""
}
`
    : "";

const whyBlock =
  benchCase === "fleet"
    ? `Each of ${consumers} consumers that imports the registry/SDK barrel pays the full first-party graph again under naive ×M. Selective ESM keeps per-app cost near the call sites you bind. Multi-entry shared mode shows how much a monorepo/shared-chunk build recovers for the singleton arm — ESM was already near the call-site floor.`
    : benchCase === "thirdparty"
      ? thirdParty?.mode === "real"
        ? `Shared graphql (real core) is paid either way once a domain package is imported. The registry still ships unused SDK extras (dataloader / graphql-tag / uuid) plus every first-party package. Absolute bytes include real npm graphs; the packaging gap remains the unused-extra + first-party registry choice.`
        : `Shared third-party runtime (stub core) is paid either way. The registry still ships unused 3p extras plus every first-party package. Pass --3p=real for pinned npm graphs; the first-party + unused-SDK gap remains the packaging choice.`
      : `A singleton registry does not just import all ${n} packages: it pulls every function inside them (cycles drag more). That graph does not tree-shake. ESM pays only for ~${callSites} call sites (${callSiteCoveragePct}% of the surface). Brutal when many consumers share the registry, or GraphQL sits on ${n}+ packages but only wires some resolvers. Cold start and deploy size follow the module graph, not the resolvers you actually registered.`;

const md = `# Scale bench ${benchCase}

- **When:** ${report.timestamp}
- **Case:** ${benchCase}
- **N:** ${n}
- **Fns/svc:** ${fns}
- **Surface:** ${surfaceFns} functions (${n} × ${fns})
- **Call sites (both arms):** ${callSites}${multiCall ? `: packages [${usedPackageIds.join(", ")}]` : ": ESM imports only \`used\` from svc-0"}
- **Consumers:** ${benchCase === "fleet" ? consumers : 1}${benchCase === "fleet" ? ` (fleet-mode=${fleetMode})` : ""}
- **Cycles:** ${cycles}
- **Host:** esbuild
- **Mode:** ${mode}${thirdParty ? `\n- **3p:** ${thirdParty.mode} (${thirdParty.count} pkgs)` : ""}

${report.note}

${report.methodologyLimits ? `> **Methodology limits:** ${report.methodologyLimits}\n` : ""}
## Results

| Arm | Size | Build (ms) | Used markers | Unused retained | 3p markers |
|-----|------|----------:|-------------:|----------------:|-----------:|
| Singleton | ${singletonSize.detail} | ${singleton.metrics.buildMs} | ${singleton.metrics.markersUsedPresent} | ${singleton.metrics.markersUnusedRetained} | ${singleton.metrics.thirdPartyMarkersRetained} |
| ESM | ${esmSize.detail} | ${esm.metrics.buildMs} | ${esm.metrics.markersUsedPresent} | ${esm.metrics.markersUnusedRetained} | ${esm.metrics.thirdPartyMarkersRetained} |

## Benefit (percentage comparison)

| Metric | Value |
|--------|------:|
| Bytes saved vs singleton | ${bytesSavedPct}% |
| Absolute saved | ${savedSize.detail} |
| ESM as % of singleton | ${esmOfSingletonPct}% |
| Singleton / ESM size | ${singletonVsEsmFactor}× |
| Call-site coverage of surface | ${callSiteCoveragePct}% (${callSites}/${surfaceFns}) |
| Unused markers removed | ${unusedRemovedPct}% (Δ ${unusedMarkersDelta}) |
${tpSection}${fleetSection}
## Why this matters

${whyBlock}

## Commands

\`\`\`bash
bun run lab:bench:smoke
bun run lab:bench -- --n=100 --used=200
bun run lab:bench:wide -- --n=100 --used=300
bun run lab:bench:cycles -- --n=100 --used=300
bun run lab:bench:partial -- --n=100 --used=500
bun run lab:bench:thirdparty -- --n=100
bun run lab:bench:thirdparty:real -- --n=100
bun run lab:bench:fleet -- --n=50 --consumers=100
bun run lab:bench:coldstart
\`\`\`
`;

writeFileSync(mdPath, md);
if (!publishLatest) {
  console.warn(
    smoke || n <= 3
      ? "Smoke/tiny N=3: wrote report under tmp/ only (does not overwrite docs/lab published latest)."
      : "Skipping docs/lab publish for this run.",
  );
}

const bar = (pct: number) => {
  const w = 20;
  const filled = Math.max(0, Math.min(w, Math.round((pct / 100) * w)));
  return "█".repeat(filled) + "░".repeat(w - filled);
};

const fleetLog =
  fleet && fleetSavedSize
    ? `
  FLEET ×${consumers}  mode=${fleetMode}
${
  fleetNaive
    ? `  naive×M     singleton ${formatBytesDetail(fleetNaive.singletonBytes)}  esm ${formatBytesDetail(fleetNaive.esmBytes)}  saved ${fleetNaive.bytesSavedPct}%
`
    : ""
}${
  fleetSharedTotals
    ? `  shared      singleton ${formatBytesDetail(fleetSharedTotals.singletonBytes)}  esm ${formatBytesDetail(fleetSharedTotals.esmBytes)}  saved ${fleetSharedTotals.bytesSavedPct}%
${sharedVsNaivePct != null ? `  share vs ×M  ${sharedVsNaivePct}% less singleton than naive\n` : ""}`
    : ""
}`
    : "";

console.log(`
╔══════════════════════════════════════════╗
║     SCALE BENCH  singleton vs ESM        ║
╚══════════════════════════════════════════╝
  case=${benchCase}  N=${n}  fns=${fns}  cycles=${cycles}
  callSites=${callSites}/${surfaceFns} (${callSiteCoveragePct}% of surface)
  packages=[${usedPackageIds.join(",")}]
  consumers=${benchCase === "fleet" ? consumers : 1}${benchCase === "fleet" ? `  fleet-mode=${fleetMode}` : ""}
  host=esbuild  mode=${mode}
${thirdParty ? `  3p=${thirdParty.mode}:${thirdParty.count}×${thirdParty.bytesPerPackage}B\n` : ""}
  SINGLETON  ${formatBytesDetail(singleton.metrics.bytes)}
             unused×${singleton.metrics.markersUnusedRetained}  used×${singleton.metrics.markersUsedPresent}  3p×${singleton.metrics.thirdPartyMarkersRetained}
  ESM        ${formatBytesDetail(esm.metrics.bytes)}
             unused×${esm.metrics.markersUnusedRetained}  used×${esm.metrics.markersUsedPresent}  3p×${esm.metrics.thirdPartyMarkersRetained}

  COMPARISON
  bytes saved     ${bytesSavedPct}%  (${formatBytesDetail(bytesSavedAbs)})
  ESM / singleton ${esmOfSingletonPct}%
  singleton/ESM   ${singletonVsEsmFactor}× larger
  unused removed  ${unusedRemovedPct}%  (Δ ${unusedMarkersDelta})
  ${bar(bytesSavedPct)}
${fleetLog}
  → ${publishLatest ? `docs/lab/${reportBase}` : `tmp/lab-bench/${reportBase}`}.md
  → ${publishLatest ? `docs/lab/${reportBase}` : `tmp/lab-bench/${reportBase}`}.json
`);

const unusedPerSvc = fns - 1;
// Bound unused_* resolvers intentionally remain in ESM; unbound unused must not.
const esmUnusedOk =
  esm.metrics.markersUnusedRetained === expectedBoundUnusedMarkers;
const esmUsedOk = esm.metrics.markersUsedPresent === expectedUsedMarkers;
// Singleton side-effect-imports all N, so every USED literal may remain.
const singletonUsedOk =
  singleton.metrics.markersUsedPresent >= Math.max(1, expectedUsedMarkers);
const singletonMin =
  smoke ? 2 : Math.min(n * unusedPerSvc, Math.max(10, unusedPerSvc));
const singletonPollutes =
  singleton.metrics.markersUnusedRetained >= singletonMin;
const esmSmaller = esm.metrics.bytes < singleton.metrics.bytes;
const tpSingletonOk =
  !thirdParty ||
  singleton.metrics.thirdPartyMarkersRetained === expectedTpSingleton;
const tpEsmOk =
  !thirdParty || esm.metrics.thirdPartyMarkersRetained === expectedTpEsm;
const fleetNaiveOk =
  fleetNaive == null ||
  (fleetNaive.singletonBytes === singleton.metrics.bytes * consumers &&
    fleetNaive.esmBytes === esm.metrics.bytes * consumers);
const fleetSharedOk =
  fleetSharedTotals == null ||
  (fleetSharedTotals.singletonBytes > 0 &&
    fleetSharedTotals.esmBytes > 0 &&
    fleetSharedTotals.esmBytes < fleetSharedTotals.singletonBytes &&
    (fleetNaive == null ||
      fleetSharedTotals.singletonBytes < fleetNaive.singletonBytes));
const fleetOk =
  benchCase !== "fleet" ||
  (fleet != null && fleetNaiveOk && fleetSharedOk);

if (
  !esmUnusedOk ||
  !esmUsedOk ||
  !singletonUsedOk ||
  !singletonPollutes ||
  !esmSmaller ||
  !tpSingletonOk ||
  !tpEsmOk ||
  !fleetOk
) {
  console.error("FAIL: expected ESM to drop unused markers and shrink vs singleton");
  console.error({
    esmUnusedOk,
    esmUsedOk,
    singletonUsedOk,
    singletonPollutes,
    esmSmaller,
    tpSingletonOk,
    tpEsmOk,
    fleetOk,
    fleetNaiveOk,
    fleetSharedOk,
    expectedUsedMarkers,
    expectedBoundUnusedMarkers,
    expectedTpSingleton,
    expectedTpEsm,
    report,
  });
  process.exit(1);
}

if (!existsSync(singleton.outfile) || !existsSync(esm.outfile)) {
  process.exit(1);
}

console.log("PASS");
