import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { describe, expect, it } from "vitest";
import { buildRunOptions, resolveSandboxProvider } from "./orchestrate";

describe("resolveSandboxProvider", () => {
  it("defaults to the docker provider", () => {
    const provider = resolveSandboxProvider();

    expect(provider.name).toBe(docker().name);
  });

  it("accepts an explicit image name", () => {
    const provider = resolveSandboxProvider("docker", "sandcastle:custom");

    expect(provider.name).toBe(docker({ imageName: "sandcastle:custom" }).name);
  });

  it("throws on an unknown provider: the single seam this function guards", () => {
    expect(() => resolveSandboxProvider("vercel")).toThrow(
      /Unknown sandbox provider "vercel"/,
    );
  });
});

describe("buildRunOptions", () => {
  it("targets the per-issue branch and prompt file, defaulting to docker", () => {
    const options = buildRunOptions({ issueNumber: "42" });

    expect(options.branchStrategy).toEqual({
      type: "branch",
      branch: "agent/issue-42",
    });
    expect(options.promptFile).toBe(".sandcastle/prompt.md");
    expect(options.promptArgs).toEqual({ ISSUE_NUMBER: "42" });
    expect(options.sandbox.name).toBe(docker().name);
    expect(options.maxIterations).toBeGreaterThan(0);
  });

  it("accepts a caller-supplied sandbox provider: the swappable config seam", () => {
    const customSandbox = docker({ imageName: "sandcastle:custom" });

    const options = buildRunOptions({ issueNumber: "1", sandbox: customSandbox });

    expect(options.sandbox).toBe(customSandbox);
  });

  it("rejects a blank issue number", () => {
    expect(() => buildRunOptions({ issueNumber: "   " })).toThrow(/issueNumber/);
  });
});
