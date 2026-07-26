/**
 * Scale bench: esbuild singleton vs ESM, write report artifacts.
 *
 *   bun run scripts/lab/run-scale-bench.ts --smoke
 *   bun run scripts/lab/run-scale-bench.ts --n=100 --used=200
 *   bun run scripts/lab/run-scale-bench.ts --case=wide --n=100 --used=300
 *   bun run scripts/lab/run-scale-bench.ts --case=cycles --n=100 --used=300
 *   bun run scripts/lab/run-scale-bench.ts --case=partial --n=100 --used=500
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import * as esbuild from "esbuild";
import { byteParts, formatBytesDetail } from "./format-bytes.ts";

const ROOT = join(import.meta.dir, "../..");
const OUT_DIR = join(ROOT, "tmp/lab-bench");
const DOCS_LAB = join(ROOT, "docs/lab");
const FIXTURE_GEN = join(ROOT, "scripts/lab/fixtures/.generated");

function argValue(flag: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit?.slice(flag.length + 1);
}

type BenchCase = "baseline" | "wide" | "cycles" | "partial";

const smoke = process.argv.includes("--smoke");
const caseRaw = (argValue("--case") ?? "baseline") as BenchCase;
if (!["baseline", "wide", "cycles", "partial"].includes(caseRaw)) {
  console.error("Invalid --case (baseline|wide|cycles|partial)");
  process.exit(2);
}
const benchCase: BenchCase = smoke ? "baseline" : caseRaw;

const nFlag = argValue("--n");
const n = smoke ? 3 : Number(nFlag ?? "100");
const mode = smoke ? "smoke" : "generated";

const fnsFlag = argValue("--fns");
const usedFlag = argValue("--used");
const seedFlag = argValue("--seed");
const cyclesFlag = process.argv.includes("--cycles");

let fns: number;
let cycles: boolean;
if (smoke || benchCase === "baseline") {
  fns = 2;
  cycles = false;
} else if (benchCase === "wide" || benchCase === "partial") {
  fns = Number(fnsFlag ?? "20");
  cycles = false;
} else {
  // cycles
  fns = Number(fnsFlag ?? "20");
  cycles = true;
}
if (cyclesFlag && (benchCase === "baseline" || benchCase === "partial")) {
  console.error("Cycles only via --case=cycles");
  process.exit(2);
}
if (!Number.isFinite(fns) || fns < 2 || fns > 200) {
  console.error("Invalid --fns (2..200)");
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

const reportBase =
  benchCase === "baseline"
    ? "benchmark-latest"
    : benchCase === "wide"
      ? "benchmark-wide-latest"
      : benchCase === "cycles"
        ? "benchmark-cycles-latest"
        : "benchmark-partial-latest";

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
  const genArgs = [
    "run",
    "scripts/lab/generate-scale-bench.ts",
    `--n=${n}`,
    `--fns=${fns}`,
    `--case=${benchCase}`,
  ];
  if (cycles) genArgs.push("--cycles");
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
};

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
    write: true,
    logLevel: "silent",
    plugins: [labResolvePlugin],
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

  return {
    outfile,
    metrics: {
      bytes,
      buildMs,
      markersUsedPresent,
      markersUnusedRetained,
      markersUnusedTotal,
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
  host: "esbuild" as const,
  mode,
  note:
    multiCall
      ? `App binds ${callSites} of ${surfaceFns} surface functions across ${usedPackageIds.length} packages. Both arms call the same ${callSites} sites; singleton still registers all ${n} packages${cycles ? " (cycles may still drag the full ring into ESM)" : ""}.`
      : `ESM call sites: 1 (import { used } from svc-0 only). Surface still ${surfaceFns} fns across ${n} packages; --fns only grows what can be shaken, not what ESM calls.`,
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
};

const jsonPath = join(DOCS_LAB, `${reportBase}.json`);
const mdPath = join(DOCS_LAB, `${reportBase}.md`);

writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");

const md = `# Scale bench ${benchCase}

- **When:** ${report.timestamp}
- **Case:** ${benchCase}
- **N:** ${n}
- **Fns/svc:** ${fns}
- **Surface:** ${surfaceFns} functions (${n} × ${fns})
- **Call sites (both arms):** ${callSites}${multiCall ? `: packages [${usedPackageIds.join(", ")}]` : ": ESM imports only \`used\` from svc-0"}
- **Cycles:** ${cycles}
- **Host:** esbuild
- **Mode:** ${mode}

${report.note}

## Results

| Arm | Size | Build (ms) | Used markers | Unused retained |
|-----|------|----------:|-------------:|----------------:|
| Singleton | ${singletonSize.detail} | ${singleton.metrics.buildMs} | ${singleton.metrics.markersUsedPresent} | ${singleton.metrics.markersUnusedRetained} |
| ESM | ${esmSize.detail} | ${esm.metrics.buildMs} | ${esm.metrics.markersUsedPresent} | ${esm.metrics.markersUnusedRetained} |

## Benefit (percentage comparison)

| Metric | Value |
|--------|------:|
| Bytes saved vs singleton | ${bytesSavedPct}% |
| Absolute saved | ${savedSize.detail} |
| ESM as % of singleton | ${esmOfSingletonPct}% |
| Singleton / ESM size | ${singletonVsEsmFactor}× |
| Call-site coverage of surface | ${callSiteCoveragePct}% (${callSites}/${surfaceFns}) |
| Unused markers removed | ${unusedRemovedPct}% (Δ ${unusedMarkersDelta}) |

## Why this matters

A singleton registry does not just import all ${n} packages: it pulls every function inside them (cycles drag more). That graph does not tree-shake. ESM pays only for ~${callSites} call sites (${callSiteCoveragePct}% of the surface). Brutal when many consumers share the registry, or GraphQL sits on ${n}+ packages but only wires some resolvers. Cold start and deploy size follow the module graph, not the resolvers you actually registered.

## Commands

\`\`\`bash
bun run lab:bench:smoke
bun run lab:bench -- --n=100 --used=200
bun run lab:bench:wide -- --n=100 --used=300
bun run lab:bench:cycles -- --n=100 --used=300
bun run lab:bench:partial -- --n=100 --used=500
\`\`\`
`;

writeFileSync(mdPath, md);

const bar = (pct: number) => {
  const w = 20;
  const filled = Math.max(0, Math.min(w, Math.round((pct / 100) * w)));
  return "█".repeat(filled) + "░".repeat(w - filled);
};

console.log(`
╔══════════════════════════════════════════╗
║     SCALE BENCH  singleton vs ESM        ║
╚══════════════════════════════════════════╝
  case=${benchCase}  N=${n}  fns=${fns}  cycles=${cycles}
  callSites=${callSites}/${surfaceFns} (${callSiteCoveragePct}% of surface)
  packages=[${usedPackageIds.join(",")}]
  host=esbuild  mode=${mode}

  SINGLETON  ${formatBytesDetail(singleton.metrics.bytes)}
             unused×${singleton.metrics.markersUnusedRetained}  used×${singleton.metrics.markersUsedPresent}
  ESM        ${formatBytesDetail(esm.metrics.bytes)}
             unused×${esm.metrics.markersUnusedRetained}  used×${esm.metrics.markersUsedPresent}

  COMPARISON
  bytes saved     ${bytesSavedPct}%  (${formatBytesDetail(bytesSavedAbs)})
  ESM / singleton ${esmOfSingletonPct}%
  singleton/ESM   ${singletonVsEsmFactor}× larger
  unused removed  ${unusedRemovedPct}%  (Δ ${unusedMarkersDelta})
  ${bar(bytesSavedPct)}

  → docs/lab/${reportBase}.md
  → docs/lab/${reportBase}.json
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

if (
  !esmUnusedOk ||
  !esmUsedOk ||
  !singletonUsedOk ||
  !singletonPollutes ||
  !esmSmaller
) {
  console.error("FAIL: expected ESM to drop unused markers and shrink vs singleton");
  console.error({
    esmUnusedOk,
    esmUsedOk,
    singletonUsedOk,
    singletonPollutes,
    esmSmaller,
    expectedUsedMarkers,
    expectedBoundUnusedMarkers,
    report,
  });
  process.exit(1);
}

if (!existsSync(singleton.outfile) || !existsSync(esm.outfile)) {
  process.exit(1);
}

console.log("PASS");
