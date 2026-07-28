/**
 * Cold-start / RSS harness: Node import wall time + process memory for
 * singleton vs ESM fixtures.
 *
 * Workers isolate boot (workerd/miniflare) is intentionally out of scope —
 * too heavy and noisy for CI. Documented as a methodology limit.
 *
 * Default N=50 writes research-scale docs/lab/benchmark-coldstart-latest.*.
 * Smoke override `--n=3` asserts only (does not overwrite published latest).
 *
 *   bun run scripts/lab/run-coldstart-bench.ts
 *   bun run scripts/lab/run-coldstart-bench.ts --n=3
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import * as esbuild from "esbuild";
import {
  coldStartBenefit,
  reportArtifactBase,
} from "./bench-metrics.ts";
import { byteParts, formatBytesDetail } from "./format-bytes.ts";
import { resolveThirdPartyPackage } from "./third-party-stubs.ts";

const ROOT = join(import.meta.dir, "../..");
const OUT_DIR = join(ROOT, "tmp/lab-bench/coldstart");
const DOCS_LAB = join(ROOT, "docs/lab");
const reportBase = reportArtifactBase("coldstart");

function argValue(flag: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit?.slice(flag.length + 1);
}

const n = Number(argValue("--n") ?? "50");
if (!Number.isFinite(n) || n < 3 || n > 100) {
  console.error("Invalid --n (3..100); coldstart defaults to research N=50");
  process.exit(2);
}

const mode = n === 3 ? "smoke" : "generated";

if (mode === "generated") {
  const gen = spawnSync(
    "bun",
    ["run", "scripts/lab/generate-scale-bench.ts", `--n=${n}`, "--fns=2"],
    { cwd: ROOT, stdio: "inherit" },
  );
  if (gen.status !== 0) process.exit(gen.status ?? 1);
  const install = spawnSync("bun", ["install"], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (install.status !== 0) process.exit(install.status ?? 1);
}

const pkgPrefix =
  mode === "smoke"
    ? {
        singleton: "@lab/smoke-singleton-svc",
        esm: "@lab/smoke-esm-svc",
        register: "@lab/smoke-singleton-register",
      }
    : {
        singleton: "@lab/singleton-svc",
        esm: "@lab/esm-svc",
        register: "@lab/singleton-register",
      };

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
  const tp = resolveThirdPartyPackage(ROOT, specifier, mode);
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

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(DOCS_LAB, { recursive: true });

const esmEntry = join(ROOT, `scripts/lab/fixtures/esm-entry.${mode}.ts`);
const singletonEntry = join(
  ROOT,
  `scripts/lab/fixtures/singleton-entry.${mode}.ts`,
);

async function bundle(arm: "singleton" | "esm"): Promise<{
  outfile: string;
  bytes: number;
  buildMs: number;
}> {
  const entry = arm === "esm" ? esmEntry : singletonEntry;
  const outfile = join(OUT_DIR, `${arm}.mjs`);
  const t0 = performance.now();
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    outfile,
    format: "esm",
    platform: "node",
    target: "node20",
    write: true,
    logLevel: "silent",
    plugins: [labResolvePlugin],
    absWorkingDir: ROOT,
  });
  const buildMs = Math.round(performance.now() - t0);
  const bytes = Buffer.byteLength(readFileSync(outfile, "utf8"), "utf8");
  return { outfile, bytes, buildMs };
}

const singletonBundle = await bundle("singleton");
const esmBundle = await bundle("esm");

type ProbeResult = {
  importMs: number;
  rssBytes: number;
  heapUsedBytes: number;
};

function probeImport(outfile: string): ProbeResult {
  const probe = `
const t0 = performance.now();
const mod = await import(${JSON.stringify(outfile)});
const t1 = performance.now();
const mem = process.memoryUsage();
if (!mod || typeof mod !== "object") throw new Error("no exports");
process.stdout.write(JSON.stringify({
  importMs: Number((t1 - t0).toFixed(2)),
  rssBytes: mem.rss,
  heapUsedBytes: mem.heapUsed,
}));
`;
  const probePath = join(OUT_DIR, `probe-${outfile.includes("esm") ? "esm" : "singleton"}.mjs`);
  writeFileSync(probePath, probe);
  // Fresh Node process so RSS reflects parse/compile of this graph only
  // (plus Node baseline). Prefer node over bun for host=node labeling.
  const node = spawnSync("node", [probePath], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, NODE_OPTIONS: "" },
  });
  if (node.status !== 0) {
    console.error(node.stderr || node.stdout);
    process.exit(node.status ?? 1);
  }
  const parsed = JSON.parse(node.stdout.trim()) as ProbeResult;
  if (
    !Number.isFinite(parsed.importMs) ||
    !Number.isFinite(parsed.rssBytes) ||
    !Number.isFinite(parsed.heapUsedBytes)
  ) {
    console.error("Invalid probe payload", parsed);
    process.exit(1);
  }
  return parsed;
}

const singletonProbe = probeImport(singletonBundle.outfile);
const esmProbe = probeImport(esmBundle.outfile);
const benefit = coldStartBenefit(singletonProbe, esmProbe);

const report = {
  version: 1 as const,
  timestamp: new Date().toISOString(),
  case: "coldstart" as const,
  n,
  host: "node" as const,
  mode,
  note:
    "Node cold import: wall time to first module evaluation + process RSS/heap after import. " +
    "esbuild finishes before the clock; each arm times import of one already-bundled .mjs in a fresh child process. " +
    "Workers/workerd isolate boot is not measured here (too heavy/noisy for the lab).",
  methodologyLimits:
    "RSS includes ~45 MB Node baseline + V8 heap for the bundled graph — not a Cloudflare Worker isolate. " +
    "Published latest uses research N=50 (smoke --n=3 is CI-local only and does not overwrite this artifact). " +
    "Import ms is one-shot (no warmup average). Order-of-magnitude evidence that retained JS costs parse/memory, not a production SLO.",
  arms: {
    singleton: {
      bytes: singletonBundle.bytes,
      buildMs: singletonBundle.buildMs,
      importMs: singletonProbe.importMs,
      rssBytes: singletonProbe.rssBytes,
      heapUsedBytes: singletonProbe.heapUsedBytes,
      size: byteParts(singletonBundle.bytes),
      rssSize: byteParts(singletonProbe.rssBytes),
      heapSize: byteParts(singletonProbe.heapUsedBytes),
    },
    esm: {
      bytes: esmBundle.bytes,
      buildMs: esmBundle.buildMs,
      importMs: esmProbe.importMs,
      rssBytes: esmProbe.rssBytes,
      heapUsedBytes: esmProbe.heapUsedBytes,
      size: byteParts(esmBundle.bytes),
      rssSize: byteParts(esmProbe.rssBytes),
      heapSize: byteParts(esmProbe.heapUsedBytes),
    },
  },
  benefit: {
    importMsSaved: benefit.importMsSaved,
    importMsSavedPct: benefit.importMsSavedPct,
    rssBytesSaved: benefit.rssBytesSaved,
    rssBytesSavedPct: benefit.rssBytesSavedPct,
    rssSizeSaved: byteParts(benefit.rssBytesSaved),
  },
};

const md = `# Cold start / RSS (Node)

- **When:** ${report.timestamp}
- **N:** ${n}
- **Host:** Node (fresh process per arm)
- **Mode:** ${mode}

${report.note}

> **Methodology limits:** ${report.methodologyLimits}

## Results

| Arm | Bundle | Import (ms) | RSS | Heap used |
|-----|--------|------------:|----:|----------:|
| Singleton | ${report.arms.singleton.size.detail} | ${singletonProbe.importMs} | ${report.arms.singleton.rssSize.detail} | ${report.arms.singleton.heapSize.detail} |
| ESM | ${report.arms.esm.size.detail} | ${esmProbe.importMs} | ${report.arms.esm.rssSize.detail} | ${report.arms.esm.heapSize.detail} |

## Benefit

| Metric | Value |
|--------|------:|
| Import time saved | ${benefit.importMsSaved} ms (${benefit.importMsSavedPct}%) |
| RSS saved | ${formatBytesDetail(benefit.rssBytesSaved)} (${benefit.rssBytesSavedPct}%) |

## Why this matters

Retained module graphs cost parse/compile time and resident memory, not just deploy bytes. This harness measures that on Node for the same singleton vs ESM fixtures the scale bench uses.

## Commands

\`\`\`bash
bun run lab:bench:coldstart
bun run lab:bench:coldstart -- --n=3
\`\`\`
`;

const publishLatest = mode !== "smoke";
let jsonPath = join(OUT_DIR, `${reportBase}.json`);
let mdPath = join(OUT_DIR, `${reportBase}.md`);
if (publishLatest) {
  jsonPath = join(DOCS_LAB, `${reportBase}.json`);
  mdPath = join(DOCS_LAB, `${reportBase}.md`);
}
writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");
writeFileSync(mdPath, md);
if (!publishLatest) {
  console.warn(
    "Smoke N=3: wrote report under tmp/ only (does not overwrite docs/lab published latest).",
  );
}

console.log(`
╔══════════════════════════════════════════╗
║     COLD START  Node import + RSS       ║
╚══════════════════════════════════════════╝
  N=${n}  host=node  mode=${mode}

  SINGLETON  import ${singletonProbe.importMs} ms  RSS ${formatBytesDetail(singletonProbe.rssBytes)}
  ESM        import ${esmProbe.importMs} ms  RSS ${formatBytesDetail(esmProbe.rssBytes)}

  saved import ${benefit.importMsSaved} ms (${benefit.importMsSavedPct}%)
  saved RSS    ${formatBytesDetail(benefit.rssBytesSaved)} (${benefit.rssBytesSavedPct}%)

  → ${publishLatest ? `docs/lab/${reportBase}` : `tmp/lab-bench/coldstart/${reportBase}`}.md
  → ${publishLatest ? `docs/lab/${reportBase}` : `tmp/lab-bench/coldstart/${reportBase}`}.json
`);

const esmFasterOrEqual = esmProbe.importMs <= singletonProbe.importMs * 1.5;
const esmLeanerRss = esmProbe.rssBytes <= singletonProbe.rssBytes;
const esmSmallerBundle = esmBundle.bytes < singletonBundle.bytes;

if (!esmSmallerBundle || (!esmFasterOrEqual && !esmLeanerRss)) {
  console.error("FAIL: expected ESM cold-start to be smaller/faster/leaner", {
    esmSmallerBundle,
    esmFasterOrEqual,
    esmLeanerRss,
    report,
  });
  process.exit(1);
}

console.log("PASS");
