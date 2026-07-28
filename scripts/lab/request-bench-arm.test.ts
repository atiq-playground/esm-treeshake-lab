import { describe, expect, test } from "bun:test";
import { REQUEST_DISCLAIMER } from "./bench-metrics.ts";
import {
  REQUEST_ARM_ISOLATION,
  buildRequestArmProbeSource,
  parseRequestArmProbeStdout,
  requestArmSpawnArgs,
} from "./request-bench-arm.ts";

describe("REQUEST_ARM_ISOLATION", () => {
  test("locks fresh Node child per arm (no shared resident graph)", () => {
    expect(REQUEST_ARM_ISOLATION.host).toBe("node");
    expect(REQUEST_ARM_ISOLATION.freshProcessPerArm).toBe(true);
    expect(REQUEST_ARM_ISOLATION.clearNodeOptions).toBe(true);
  });
});

describe("REQUEST_DISCLAIMER (request isolation)", () => {
  test("states fresh process per arm and Node ≠ CF isolate / gateway RPS", () => {
    expect(REQUEST_DISCLAIMER).toMatch(/fresh (Node )?process per arm/i);
    expect(REQUEST_DISCLAIMER).toMatch(/Cloudflare isolate/i);
    expect(REQUEST_DISCLAIMER).toMatch(/gateway RPS/i);
  });
});

describe("buildRequestArmProbeSource", () => {
  test("embeds only the given arm bundle path for import", () => {
    const source = buildRequestArmProbeSource({
      bundlePath: "/tmp/lab-bench/esm-realistic.js",
      warmup: 2,
      measured: 5,
    });
    expect(source).toContain("/tmp/lab-bench/esm-realistic.js");
    expect(source).not.toContain("singleton-realistic");
    expect(source).toMatch(/import\(/);
    expect(source).toMatch(/warmup/);
    expect(source).toMatch(/measured/);
    expect(source).toMatch(/POST/);
    expect(source).toMatch(/\/invoke/);
  });
});

describe("parseRequestArmProbeStdout", () => {
  test("parses child metrics JSON from stdout", () => {
    const payload = {
      latenciesMs: [1.2, 1.4, 1.3],
      warmup: 2,
      measured: 3,
      concurrency: 1,
      cpuUserMs: 4.5,
      cpuSystemMs: 0.25,
      rssBytes: 12_000_000,
      heapUsedBytes: 6_000_000,
    };
    const parsed = parseRequestArmProbeStdout(JSON.stringify(payload) + "\n");
    expect(parsed).toEqual(payload);
  });

  test("rejects invalid child payloads", () => {
    expect(() => parseRequestArmProbeStdout("{}")).toThrow(/Invalid/);
    expect(() =>
      parseRequestArmProbeStdout(
        JSON.stringify({
          latenciesMs: "nope",
          warmup: 1,
          measured: 1,
          concurrency: 1,
          cpuUserMs: 1,
          cpuSystemMs: 1,
          rssBytes: 1,
          heapUsedBytes: 1,
        }),
      ),
    ).toThrow(/Invalid/);
  });
});

describe("requestArmSpawnArgs", () => {
  test("spawns node with the probe path and cleared NODE_OPTIONS", () => {
    const { command, args, env } = requestArmSpawnArgs({
      probePath: "/tmp/request-probe-esm.mjs",
      parentEnv: { PATH: "/usr/bin", NODE_OPTIONS: "--inspect" },
    });
    expect(command).toBe("node");
    expect(args).toEqual(["/tmp/request-probe-esm.mjs"]);
    expect(env.NODE_OPTIONS).toBe("");
    expect(env.PATH).toBe("/usr/bin");
  });
});
