/**
 * Sweep Bun + esbuild practicality across N and use cases.
 * Writes docs/research/scale-bench-sweep.json (does not leave docs/lab
 * "latest" stuck on the last stress N: restores UC reports at N=100 after).
 *
 *   bun run scripts/lab/probe-scale-practicality.ts
 *   bun run scripts/lab/probe-scale-practicality.ts --n=3,100
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import * as esbuild from "esbuild";
import { byteParts } from "./format-bytes.ts";

const ROOT = join(import.meta.dir, "../..");
const OUT_DIR = join(ROOT, "tmp/lab-bench");
const GEN_ROOT = join(ROOT, "packages/lab/generated");
const RESEARCH_JSON = join(ROOT, "docs/research/scale-bench-sweep.json");

type BenchCase = "baseline" | "wide" | "cycles" | "partial";

type SweepRow = {
  case: BenchCase;
  n: number;
  fns: number;
  cycles: boolean;
  callSites: number;
  genMs: number;
  installMs: number;
  treeBytes: number;
  singletonBuildMs: number;
  esmBuildMs: number;
  singletonBytes: number;
  esmBytes: number;
  singletonUnusedRetained: number;
  esmUnusedRetained: number;
  singletonUsedPresent: number;
  esmUsedPresent: number;
  bytesSavedPct: number;
};

function argValue(flag: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit?.slice(flag.length + 1);
}

const nArg = argValue("--n");
const NS = (nArg ?? "3,100,1000,2000,5000,10000")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n >= 1);

/** wide before partial so partial reuses the same generated tree. */
const CASES: Array<{
  case: BenchCase;
  fns: number;
  cycles: boolean;
}> = [
  { case: "baseline", fns: 2, cycles: false },
  { case: "wide", fns: 20, cycles: false },
  { case: "partial", fns: 20, cycles: false },
  { case: "cycles", fns: 20, cycles: true },
];

function duBytes(path: string): number {
  if (!existsSync(path)) return 0;
  const r = spawnSync("du", ["-sb", path], { encoding: "utf8" });
  if (r.status !== 0) return 0;
  return Number((r.stdout ?? "").trim().split(/\s+/)[0] ?? 0);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)}MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

function resolveLabPackage(specifier: string): string | undefined {
  if (specifier === "@lab/singleton-services") {
    return join(ROOT, "packages/lab/singleton-services/src/index.ts");
  }
  if (specifier === "@lab/singleton-register") {
    return join(ROOT, "packages/lab/generated/singleton/register/src/index.ts");
  }
  let m = /^@lab\/singleton-svc-(\d+)$/.exec(specifier);
  if (m) {
    return join(
      ROOT,
      `packages/lab/generated/singleton/svc-${m[1]}/src/index.ts`,
    );
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

function writePartialFixtures(
  n: number,
  callSites: number,
): { esm: string; singleton: string } {
  const usedIds = Array.from({ length: callSites }, (_, i) => i);
  const fixDir = join(ROOT, "scripts/lab/fixtures/.generated");
  mkdirSync(fixDir, { recursive: true });

  const esmImports = usedIds
    .map((i) => `import { used as used_${i} } from "@lab/esm-svc-${i}";`)
    .join("\n");
  const esmCalls = usedIds.map((i) => `used_${i}()`).join(", ");
  const esmPath = join(fixDir, "esm-entry.partial.ts");
  writeFileSync(
    esmPath,
    `${esmImports}\n\nexport const result = [${esmCalls}].join("|");\n`,
  );

  const singletonImports = [
    `import { registerPublicServices } from "@lab/singleton-register";`,
    ...usedIds.map(
      (i) => `import { Svc${i}Service } from "@lab/singleton-svc-${i}";`,
    ),
  ].join("\n");
  const singletonCalls = usedIds.map((i) => `Svc${i}Service.used()`).join(", ");
  const singletonPath = join(fixDir, "singleton-entry.partial.ts");
  writeFileSync(
    singletonPath,
    `${singletonImports}

registerPublicServices({ baseUrl: "http://lab.invalid" });
export const result = [${singletonCalls}].join("|");
`,
  );
  return { esm: esmPath, singleton: singletonPath };
}

async function bundleArm(
  arm: "singleton" | "esm",
  entry: string,
  outfile: string,
  n: number,
  fns: number,
  cycles: boolean,
  callSites: number,
): Promise<{
  bytes: number;
  buildMs: number;
  markersUsedPresent: number;
  markersUnusedRetained: number;
}> {
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
  return {
    bytes,
    buildMs,
    markersUsedPresent: new Set(code.match(usedRe) ?? []).size,
    markersUnusedRetained: new Set(code.match(unusedRe) ?? []).size,
  };
}

function readGenMeta(): { n: number; fns: number; cycles: boolean } | null {
  const metaPath = join(GEN_ROOT, "meta.json");
  if (!existsSync(metaPath)) return null;
  try {
    const meta = JSON.parse(readFileSync(metaPath, "utf8")) as {
      n: number;
      fns: number;
      cycles: boolean;
    };
    return meta;
  } catch {
    return null;
  }
}

function generateIfNeeded(
  n: number,
  fns: number,
  cycles: boolean,
  caseName: BenchCase,
): { genMs: number; installMs: number; treeBytes: number } {
  const meta = readGenMeta();
  const reuse =
    meta != null &&
    meta.n === n &&
    meta.fns === fns &&
    meta.cycles === cycles;

  let genMs = 0;
  if (!reuse) {
    const genCase =
      caseName === "partial" ? "wide" : caseName === "baseline" ? "baseline" : caseName;
    const args = [
      "run",
      "scripts/lab/generate-scale-bench.ts",
      `--n=${n}`,
      `--fns=${fns}`,
      `--case=${genCase}`,
    ];
    if (cycles) args.push("--cycles");
    const t0 = performance.now();
    const gen = spawnSync("bun", args, { cwd: ROOT, stdio: "inherit" });
    genMs = Math.round(performance.now() - t0);
    if (gen.status !== 0) {
      throw new Error(`generate failed for case=${caseName} n=${n}`);
    }
  } else {
    console.log(`  (reuse generated tree n=${n} fns=${fns} cycles=${cycles})`);
  }

  const t1 = performance.now();
  const install = spawnSync("bun", ["install"], {
    cwd: ROOT,
    stdio: "inherit",
  });
  const installMs = Math.round(performance.now() - t1);
  if (install.status !== 0) {
    throw new Error(`bun install failed for case=${caseName} n=${n}`);
  }

  return { genMs, installMs, treeBytes: duBytes(GEN_ROOT) };
}

async function runOne(
  n: number,
  cfg: (typeof CASES)[number],
): Promise<SweepRow> {
  const callSites =
    cfg.case === "partial" ? Math.min(8, n) : 1;

  console.log(`\n=== case=${cfg.case} n=${n} fns=${cfg.fns} cycles=${cfg.cycles} used=${callSites} ===`);

  const { genMs, installMs, treeBytes } = generateIfNeeded(
    n,
    cfg.fns,
    cfg.cycles,
    cfg.case,
  );

  mkdirSync(OUT_DIR, { recursive: true });
  const fixtures =
    cfg.case === "partial"
      ? writePartialFixtures(n, callSites)
      : {
          esm: join(ROOT, "scripts/lab/fixtures/esm-entry.generated.ts"),
          singleton: join(
            ROOT,
            "scripts/lab/fixtures/singleton-entry.generated.ts",
          ),
        };

  const singleton = await bundleArm(
    "singleton",
    fixtures.singleton,
    join(OUT_DIR, `probe-singleton-${cfg.case}-n${n}.js`),
    n,
    cfg.fns,
    cfg.cycles,
    callSites,
  );
  const esm = await bundleArm(
    "esm",
    fixtures.esm,
    join(OUT_DIR, `probe-esm-${cfg.case}-n${n}.js`),
    n,
    cfg.fns,
    cfg.cycles,
    callSites,
  );

  const bytesSavedPct =
    singleton.bytes === 0
      ? 0
      : Number(
          (((singleton.bytes - esm.bytes) / singleton.bytes) * 100).toFixed(1),
        );

  const row: SweepRow = {
    case: cfg.case,
    n,
    fns: cfg.fns,
    cycles: cfg.cycles,
    callSites,
    genMs,
    installMs,
    treeBytes,
    singletonBuildMs: singleton.buildMs,
    esmBuildMs: esm.buildMs,
    singletonBytes: singleton.bytes,
    esmBytes: esm.bytes,
    singletonUnusedRetained: singleton.markersUnusedRetained,
    esmUnusedRetained: esm.markersUnusedRetained,
    singletonUsedPresent: singleton.markersUsedPresent,
    esmUsedPresent: esm.markersUsedPresent,
    bytesSavedPct,
  };

  console.log(
    `  gen=${(genMs / 1000).toFixed(2)}s install=${(installMs / 1000).toFixed(2)}s tree=${formatBytes(treeBytes)}`,
  );
  console.log(
    `  esbuild S=${singleton.buildMs}ms E=${esm.buildMs}ms bytes ${byteParts(singleton.bytes).detail} / ${byteParts(esm.bytes).detail} saved=${bytesSavedPct}%`,
  );
  return row;
}

const rows: SweepRow[] = [];
for (const n of NS) {
  for (const cfg of CASES) {
    rows.push(await runOne(n, cfg));
  }
}

const payload = {
  version: 1 as const,
  timestamp: new Date().toISOString(),
  bun: Bun.version,
  host: "esbuild" as const,
  note:
    "Generated packages are not Bun workspace members; esbuild resolves @lab/* via plugin. bun install times reflect root lockfile refresh only. Partial uses min(8,N) call sites.",
  ns: NS,
  rows,
};

mkdirSync(join(ROOT, "docs/research"), { recursive: true });
writeFileSync(RESEARCH_JSON, JSON.stringify(payload, null, 2) + "\n");
console.log(`\nWrote ${RESEARCH_JSON} (${rows.length} rows)`);

// Restore documented default local artifacts at N=100 so docs home stays coherent.
console.log("\n=== restoring docs/lab latest reports at N=100 ===");
for (const args of [
  ["run", "scripts/lab/run-scale-bench.ts", "--n=100", "--used=200"],
  ["run", "scripts/lab/run-scale-bench.ts", "--case=wide", "--n=100", "--used=300"],
  [
    "run",
    "scripts/lab/run-scale-bench.ts",
    "--case=cycles",
    "--n=100",
    "--used=300",
  ],
  [
    "run",
    "scripts/lab/run-scale-bench.ts",
    "--case=partial",
    "--n=100",
    "--used=500",
  ],
]) {
  const r = spawnSync("bun", args, { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`restore failed: bun ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

console.log("PROBE PASS");
