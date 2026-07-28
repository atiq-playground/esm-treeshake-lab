/**
 * Request-time harness for the realistic GraphQL case.
 *
 * Per arm: fresh Node child importing that arm’s esbuild bundle only,
 * thin HTTP server, warmup + measured POST /invoke (bundle `invoke()`).
 * RSS/heap/cpu come from that child — arms do not share a resident graph.
 *
 * Defaults: warmup 50 (discard), measured 1000, concurrency 1.
 * Writes `request.singleton` / `request.esm` once into the realistic report
 * (not × warm/cold). Does not replace lab:bench:coldstart (import + RSS only).
 *
 *   bun run scripts/lab/run-request-bench.ts
 *   bun run scripts/lab/run-request-bench.ts --warmup=2 --measured=5
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildProofFromEnv,
  buildRequestArmMetrics,
  reportArtifactBase,
  REQUEST_BENCH_DEFAULTS,
  REQUEST_DISCLAIMER,
  type RequestArmMetrics,
  type RequestReport,
} from "./bench-metrics.ts";
import {
  buildRequestArmProbeSource,
  parseRequestArmProbeStdout,
  requestArmSpawnArgs,
  requestArmSpawnTimeoutMs,
} from "./request-bench-arm.ts";

const ROOT = join(import.meta.dir, "../..");
const OUT_DIR = join(ROOT, "tmp/lab-bench");
const DOCS_LAB = join(ROOT, "docs/lab");
const reportBase = reportArtifactBase("realistic");

function argValue(flag: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit?.slice(flag.length + 1);
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw new Error(`Invalid integer (>=1): ${raw}`);
  }
  return n;
}

let warmup: number;
let measured: number;
let concurrency: number;
try {
  warmup = parsePositiveInt(
    argValue("--warmup"),
    REQUEST_BENCH_DEFAULTS.warmup,
  );
  measured = parsePositiveInt(
    argValue("--measured"),
    REQUEST_BENCH_DEFAULTS.measured,
  );
  concurrency = parsePositiveInt(
    argValue("--concurrency"),
    REQUEST_BENCH_DEFAULTS.concurrency,
  );
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
}
if (concurrency !== 1) {
  console.error("Only --concurrency=1 is supported in this harness");
  process.exit(2);
}

function resolveReportPath(): string {
  const docsPath = join(DOCS_LAB, `${reportBase}.json`);
  const tmpPath = join(OUT_DIR, `${reportBase}.json`);
  if (existsSync(tmpPath)) return tmpPath;
  if (existsSync(docsPath)) return docsPath;
  throw new Error(
    `No realistic report found. Run lab:bench:realistic first (looked for ${tmpPath} and ${docsPath}).`,
  );
}

function resolveBundle(arm: "singleton" | "esm"): string {
  const path = join(OUT_DIR, `${arm}-realistic.js`);
  if (!existsSync(path)) {
    throw new Error(
      `Missing bundle ${path}. Run lab:bench:realistic first.`,
    );
  }
  return path;
}

function measureArm(arm: "singleton" | "esm"): RequestArmMetrics {
  const bundlePath = resolveBundle(arm);
  mkdirSync(OUT_DIR, { recursive: true });
  const probePath = join(OUT_DIR, `request-probe-${arm}.mjs`);
  writeFileSync(
    probePath,
    buildRequestArmProbeSource({ bundlePath, warmup, measured }),
  );

  // Fresh Node process so RSS/heap reflect this arm’s graph only
  // (plus Node baseline). Prefer node over bun for host=node labeling.
  const { command, args, env } = requestArmSpawnArgs({
    probePath,
    parentEnv: process.env,
  });
  const timeout = requestArmSpawnTimeoutMs({ warmup, measured });
  const node = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    env,
    timeout,
    killSignal: "SIGKILL",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (node.error) {
    throw new Error(
      `Request arm probe failed for ${arm}: ${node.error.message} (timeout=${timeout}ms)`,
    );
  }
  if (node.status !== 0) {
    console.error(node.stderr || node.stdout);
    throw new Error(
      `Request arm probe failed for ${arm} (exit ${node.status ?? 1})`,
    );
  }

  const payload = parseRequestArmProbeStdout(node.stdout);
  return buildRequestArmMetrics({
    latenciesMs: payload.latenciesMs,
    warmup: payload.warmup,
    measured: payload.measured,
    concurrency: payload.concurrency,
    cpuUserMs: payload.cpuUserMs,
    cpuSystemMs: payload.cpuSystemMs,
    rssBytes: payload.rssBytes,
    heapUsedBytes: payload.heapUsedBytes,
  });
}

const reportPath = resolveReportPath();
const prior = JSON.parse(readFileSync(reportPath, "utf8")) as Record<
  string,
  unknown
>;

console.log(
  `Request bench: warmup=${warmup} measured=${measured} concurrency=${concurrency} (fresh Node per arm)`,
);
console.log(`  report ← ${reportPath}`);

const singleton = measureArm("singleton");
const esm = measureArm("esm");

const request: NonNullable<RequestReport> = {
  singleton,
  esm,
  disclaimer: REQUEST_DISCLAIMER,
};

const proof = buildProofFromEnv(process.env);
const nextReport = {
  ...prior,
  request,
  proof: {
    ...((prior.proof as object | undefined) ?? {}),
    ...proof,
    // Keep pipeline proof timestamp if present; refresh only when missing.
    timestamp:
      (prior.proof as { timestamp?: string } | undefined)?.timestamp ??
      proof.timestamp,
  },
};

writeFileSync(reportPath, JSON.stringify(nextReport, null, 2) + "\n");

const mdPath = reportPath.replace(/\.json$/, ".md");
if (existsSync(mdPath)) {
  let md = readFileSync(mdPath, "utf8");
  const requestMd = `
## Request-time (Node HTTP)

> ${REQUEST_DISCLAIMER}

| Arm | p50 (ms) | p95 (ms) | CPU user (ms) | CPU system (ms) | RSS | Heap |
|-----|---------:|---------:|--------------:|----------------:|----:|-----:|
| Singleton | ${singleton.latencyMs.p50} | ${singleton.latencyMs.p95} | ${singleton.cpuUserMs} | ${singleton.cpuSystemMs} | ${singleton.rssBytes.toLocaleString("en-US")} | ${singleton.heapUsedBytes.toLocaleString("en-US")} |
| ESM | ${esm.latencyMs.p50} | ${esm.latencyMs.p95} | ${esm.cpuUserMs} | ${esm.cpuSystemMs} | ${esm.rssBytes.toLocaleString("en-US")} | ${esm.heapUsedBytes.toLocaleString("en-US")} |

Warmup discarded: ${warmup}; measured: ${measured}; concurrency: ${concurrency}. Fresh Node process per arm.
`;
  if (md.includes("## Request-time (Node HTTP)")) {
    md = md.replace(
      /## Request-time \(Node HTTP\)[\s\S]*?(?=\n## |\n$)/,
      requestMd.trim() + "\n",
    );
  } else if (md.includes("## Why this matters")) {
    md = md.replace("## Why this matters", `${requestMd.trim()}\n\n## Why this matters`);
  } else {
    md = `${md.trimEnd()}\n${requestMd}`;
  }
  writeFileSync(mdPath, md);
}

console.log(`
╔══════════════════════════════════════════╗
║   REQUEST BENCH  singleton vs ESM        ║
╚══════════════════════════════════════════╝
  ${REQUEST_DISCLAIMER}

  SINGLETON  p50=${singleton.latencyMs.p50}ms  p95=${singleton.latencyMs.p95}ms
             RSS=${singleton.rssBytes.toLocaleString("en-US")}  heap=${singleton.heapUsedBytes.toLocaleString("en-US")}
  ESM        p50=${esm.latencyMs.p50}ms  p95=${esm.latencyMs.p95}ms
             RSS=${esm.rssBytes.toLocaleString("en-US")}  heap=${esm.heapUsedBytes.toLocaleString("en-US")}

  → ${reportPath}
`);
console.log("PASS");
