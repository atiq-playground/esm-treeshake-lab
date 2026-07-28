/**
 * Pure helpers for the request-time harness spawn contract:
 * one fresh Node child per arm, importing only that arm’s bundle.
 */

export const REQUEST_ARM_ISOLATION = {
  host: "node",
  freshProcessPerArm: true,
  clearNodeOptions: true,
} as const;

export type RequestArmProbePayload = {
  latenciesMs: number[];
  warmup: number;
  measured: number;
  concurrency: number;
  cpuUserMs: number;
  cpuSystemMs: number;
  rssBytes: number;
  heapUsedBytes: number;
};

/**
 * Generates an ESM worker that imports a single arm bundle, serves
 * POST /invoke, runs warmup + measured self-fetches, then prints metrics JSON.
 */
export function buildRequestArmProbeSource(input: {
  bundlePath: string;
  warmup: number;
  measured: number;
}): string {
  const bundleLiteral = JSON.stringify(input.bundlePath);
  return `import {
  createServer,
} from "node:http";
import { pathToFileURL } from "node:url";

const bundlePath = ${bundleLiteral};
const warmup = ${input.warmup};
const measured = ${input.measured};
const concurrency = 1;

const mod = await import(pathToFileURL(bundlePath).href);
if (typeof mod.invoke !== "function") {
  throw new Error("Bundle does not export invoke(): " + bundlePath);
}
const invoke = mod.invoke;

function readBody(req) {
  return new Promise((resolve, reject) => {
    req.on("data", () => {});
    req.on("end", () => resolve());
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
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

await new Promise((resolve, reject) => {
  server.listen(0, "127.0.0.1", () => resolve());
  server.on("error", reject);
});

const addr = server.address();
if (addr == null || typeof addr === "string") {
  throw new Error("Failed to bind request bench server");
}
const baseUrl = "http://127.0.0.1:" + addr.port;

async function postInvoke() {
  const t0 = performance.now();
  const res = await fetch(baseUrl + "/invoke", { method: "POST" });
  if (!res.ok) {
    throw new Error("POST /invoke failed: " + res.status + " " + (await res.text()));
  }
  await res.text();
  return performance.now() - t0;
}

for (let i = 0; i < warmup; i++) {
  await postInvoke();
}

const cpu0 = process.cpuUsage();
const latenciesMs = [];
for (let i = 0; i < measured; i++) {
  latenciesMs.push(await postInvoke());
}
const cpu = process.cpuUsage(cpu0);
const mem = process.memoryUsage();

await new Promise((resolve, reject) => {
  server.close((err) => (err ? reject(err) : resolve()));
});

process.stdout.write(JSON.stringify({
  latenciesMs,
  warmup,
  measured,
  concurrency,
  cpuUserMs: Number((cpu.user / 1000).toFixed(2)),
  cpuSystemMs: Number((cpu.system / 1000).toFixed(2)),
  rssBytes: mem.rss,
  heapUsedBytes: mem.heapUsed,
}));
`;
}

export function parseRequestArmProbeStdout(
  stdout: string,
): RequestArmProbePayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
    throw new Error("Invalid request arm probe payload: not JSON");
  }
  if (parsed == null || typeof parsed !== "object") {
    throw new Error("Invalid request arm probe payload: expected object");
  }
  const o = parsed as Record<string, unknown>;
  if (
    !Array.isArray(o.latenciesMs) ||
    !o.latenciesMs.every((n) => typeof n === "number" && Number.isFinite(n))
  ) {
    throw new Error("Invalid request arm probe payload: latenciesMs");
  }
  for (const key of [
    "warmup",
    "measured",
    "concurrency",
    "cpuUserMs",
    "cpuSystemMs",
    "rssBytes",
    "heapUsedBytes",
  ] as const) {
    if (typeof o[key] !== "number" || !Number.isFinite(o[key])) {
      throw new Error(`Invalid request arm probe payload: ${key}`);
    }
  }
  return {
    latenciesMs: o.latenciesMs as number[],
    warmup: o.warmup as number,
    measured: o.measured as number,
    concurrency: o.concurrency as number,
    cpuUserMs: o.cpuUserMs as number,
    cpuSystemMs: o.cpuSystemMs as number,
    rssBytes: o.rssBytes as number,
    heapUsedBytes: o.heapUsedBytes as number,
  };
}

export function requestArmSpawnArgs(input: {
  probePath: string;
  parentEnv: NodeJS.ProcessEnv;
}): {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
} {
  return {
    command: REQUEST_ARM_ISOLATION.host,
    args: [input.probePath],
    env: {
      ...input.parentEnv,
      NODE_OPTIONS: REQUEST_ARM_ISOLATION.clearNodeOptions
        ? ""
        : (input.parentEnv.NODE_OPTIONS ?? ""),
    },
  };
}
