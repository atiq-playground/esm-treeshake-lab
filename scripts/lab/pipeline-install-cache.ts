/**
 * Cold vs warm Bun install prep for the realistic pipeline bench.
 * Cold must wipe node_modules + Bun's install cache before the timed install;
 * warm leaves them in place.
 */
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import type { PipelineCacheMode } from "./bench-metrics.ts";

export type PipelineInstallCachePaths = {
  root: string;
  bunInstallCache: string;
};

/** Workspace roots that may hold nested node_modules after bun install. */
const NESTED_SCAN_DIRS = ["apps", "packages"] as const;

function nestedNodeModulesDirs(root: string): string[] {
  const found: string[] = [];
  for (const top of NESTED_SCAN_DIRS) {
    const base = join(root, top);
    if (!existsSync(base)) continue;
    walkForNodeModules(base, found);
  }
  return found;
}

function walkForNodeModules(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === "node_modules") {
      out.push(join(dir, name));
      continue;
    }
    const path = join(dir, name);
    try {
      if (statSync(path).isDirectory()) walkForNodeModules(path, out);
    } catch {
      // ignore races / permission gaps in temp trees
    }
  }
}

/**
 * Prepare install caches for a pipeline mode.
 * Cold: remove root + nested node_modules and the Bun install cache.
 * Warm: no-op.
 */
export function preparePipelineInstallCache(
  mode: PipelineCacheMode,
  paths: PipelineInstallCachePaths,
): void {
  if (mode !== "cold") return;
  rmSync(join(paths.root, "node_modules"), { recursive: true, force: true });
  for (const nested of nestedNodeModulesDirs(paths.root)) {
    rmSync(nested, { recursive: true, force: true });
  }
  rmSync(paths.bunInstallCache, { recursive: true, force: true });
}
