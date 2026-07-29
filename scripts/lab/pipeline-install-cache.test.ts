import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { preparePipelineInstallCache } from "./pipeline-install-cache.ts";

function tempTree(): {
  root: string;
  bunInstallCache: string;
  rootNodeModules: string;
  nestedNodeModules: string;
  marker: string;
} {
  const root = mkdtempSync(join(tmpdir(), "pipeline-install-"));
  const bunInstallCache = mkdtempSync(join(tmpdir(), "bun-install-cache-"));
  const rootNodeModules = join(root, "node_modules");
  const nestedNodeModules = join(root, "apps", "docs", "node_modules");
  mkdirSync(rootNodeModules, { recursive: true });
  mkdirSync(nestedNodeModules, { recursive: true });
  const marker = join(bunInstallCache, "pkg.npm");
  writeFileSync(join(rootNodeModules, "keep.txt"), "root");
  writeFileSync(join(nestedNodeModules, "keep.txt"), "nested");
  writeFileSync(marker, "cache");
  return { root, bunInstallCache, rootNodeModules, nestedNodeModules, marker };
}

describe("preparePipelineInstallCache", () => {
  test("cold wipes root/workspace node_modules and the Bun install cache", () => {
    const tree = tempTree();
    preparePipelineInstallCache("cold", {
      root: tree.root,
      bunInstallCache: tree.bunInstallCache,
    });
    expect(existsSync(tree.rootNodeModules)).toBe(false);
    expect(existsSync(tree.nestedNodeModules)).toBe(false);
    expect(existsSync(tree.bunInstallCache)).toBe(false);
  });

  test("warm leaves install state intact", () => {
    const tree = tempTree();
    preparePipelineInstallCache("warm", {
      root: tree.root,
      bunInstallCache: tree.bunInstallCache,
    });
    expect(existsSync(join(tree.rootNodeModules, "keep.txt"))).toBe(true);
    expect(existsSync(join(tree.nestedNodeModules, "keep.txt"))).toBe(true);
    expect(existsSync(tree.marker)).toBe(true);
  });
});
