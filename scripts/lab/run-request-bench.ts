/**
 * Request-time harness for the realistic GraphQL case.
 *
 * Per arm: thin Node HTTP server importing that arm’s esbuild bundle.
 * POST /invoke runs one full pass of wired call sites (bundle `invoke()`).
 *
 * Defaults: warmup 50 (discard), measured 1000, concurrency 1.
 * Writes `request.singleton` / `request.esm` once into the realistic report
 * (not × warm/cold). Does not replace lab:bench:coldstart (import + RSS only).
 *
 *   bun run scripts/lab/run-request-bench.ts
 *   bun run scripts/lab/run-request-bench.ts --warmup=2 --measured=5
 */
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildProofFromEnv,
  buildRequestArmMetrics,
  reportArtifactBase,
  REQUEST_BENCH_DEFAULTS,
  REQUEST_DISCLAIMER,
  type RequestArmMetrics,
  type RequestReport,
} from "./bench-metrics.ts";

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

type InvokeModule = { invoke?: () => unknown };

async function loadInvoke(bundlePath: string): Promise<() => unknown> {
  const mod = (await import(pathToFileURL(bundlePath).href)) as InvokeModule;
  if (typeof mod.invoke !== "function") {
    throw new Error(
      `Bundle ${bundlePath} does not export invoke(). Re-run lab:bench:realistic.`,
    );
  }
  return mod.invoke;
}

function readBody(req: IncomingMessage): Promise<void> {
  return new Promise((resolve, reject) => {
    req.on("data", () => {});
    req.on("end", () => resolve());
    req.on("error", reject);
  });
}

async function withArmServer(
  invoke: () => unknown,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.method === "POST" && req.url === "/invoke") {
        await readBody(req);
        const out = invoke();
        res.statusCode = 200;
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.end(typeof out === "string" ? out : String(out));
        return;
      }
      res.statusCode = 404;
      res.end("not found");
    } catch (err) {
      res.statusCode = 500;
      res.end(err instanceof Error ? err.message : "error");
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });

  const addr = server.address();
  if (addr == null || typeof addr === "string") {
    server.close();
    throw new Error("Failed to bind request bench server");
  }
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

async function postInvoke(baseUrl: string): Promise<number> {
  const t0 = performance.now();
  const res = await fetch(`${baseUrl}/invoke`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`POST /invoke failed: ${res.status} ${await res.text()}`);
  }
  await res.text();
  return performance.now() - t0;
}

async function measureArm(
  arm: "singleton" | "esm",
): Promise<RequestArmMetrics> {
  const bundlePath = resolveBundle(arm);
  const invoke = await loadInvoke(bundlePath);

  let metrics: RequestArmMetrics | null = null;
  await withArmServer(invoke, async (baseUrl) => {
    for (let i = 0; i < warmup; i++) {
      await postInvoke(baseUrl);
    }

    const cpu0 = process.cpuUsage();
    const latencies: number[] = [];
    for (let i = 0; i < measured; i++) {
      latencies.push(await postInvoke(baseUrl));
    }
    const cpu = process.cpuUsage(cpu0);
    const mem = process.memoryUsage();

    metrics = buildRequestArmMetrics({
      latenciesMs: latencies,
      warmup,
      measured,
      concurrency,
      cpuUserMs: Number((cpu.user / 1000).toFixed(2)),
      cpuSystemMs: Number((cpu.system / 1000).toFixed(2)),
      rssBytes: mem.rss,
      heapUsedBytes: mem.heapUsed,
    });
  });

  if (metrics == null) {
    throw new Error(`Failed to measure ${arm}`);
  }
  return metrics;
}

const reportPath = resolveReportPath();
const prior = JSON.parse(readFileSync(reportPath, "utf8")) as Record<
  string,
  unknown
>;

console.log(`Request bench: warmup=${warmup} measured=${measured} concurrency=${concurrency}`);
console.log(`  report ← ${reportPath}`);

const singleton = await measureArm("singleton");
const esm = await measureArm("esm");

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

Warmup discarded: ${warmup}; measured: ${measured}; concurrency: ${concurrency}.
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
  ESM        p50=${esm.latencyMs.p50}ms  p95=${esm.latencyMs.p95}ms

  → ${reportPath}
`);
console.log("PASS");
