/**
 * Deterministic stub / real-npm "third-party" packages for the scale bench.
 * Stub mode: fixed ballast + side-effect touch so esbuild retains them.
 * Real mode: thin wrappers that side-effect-import pinned npm packages.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  REAL_THIRD_PARTY_PACKAGES,
  type ThirdPartyConfig,
} from "./bench-metrics.ts";

export const TP_CORE_NAME = "@lab/3p-core";
export const TP_CORE_MARKER = "LAB_3P_CORE";

export function tpExtraName(i: number): string {
  return `@lab/3p-extra-${i}`;
}

export function tpExtraMarker(i: number): string {
  return `LAB_3P_EXTRA_${i}`;
}

/** Extra packages beyond the shared core (count - 1). */
export function tpExtraCount(config: ThirdPartyConfig): number {
  return Math.max(0, config.count - 1);
}

export function thirdPartyStubSrc(
  marker: string,
  bytesPerPackage: number,
): string {
  const ballast = "x".repeat(bytesPerPackage);
  return `const payload = {
  marker: "${marker}",
  ballast: "${ballast}",
};

(globalThis as typeof globalThis & { __LAB_3P_TOUCH__?: number }).__LAB_3P_TOUCH__ =
  ((globalThis as typeof globalThis & { __LAB_3P_TOUCH__?: number }).__LAB_3P_TOUCH__ ?? 0) + 1;

(globalThis as typeof globalThis & { __LAB_3P_LAST__?: typeof payload }).__LAB_3P_LAST__ =
  payload;

export {};
`;
}

export function thirdPartyRealSrc(sideEffectImport: string): string {
  return `${sideEffectImport}
export {};
`;
}

function writePkg(dir: string, name: string, indexSrc: string): void {
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name,
        version: "0.0.0",
        private: true,
        type: "module",
        exports: { ".": "./src/index.ts" },
      },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(join(dir, "src/index.ts"), indexSrc);
}

/**
 * Write @lab/3p-core + @lab/3p-extra-* under rootDir/third-party/.
 * Returns import lines for the singleton register (extras only; core is per-svc).
 */
export function writeThirdPartyPackages(
  rootDir: string,
  config: ThirdPartyConfig,
): {
  coreImport: string;
  extraImports: string;
  markers: string[];
  realPackages: string[];
} {
  const tpRoot = join(rootDir, "third-party");
  const extras = tpExtraCount(config);
  const realPackages: string[] = [];

  if (config.mode === "real") {
    const core = REAL_THIRD_PARTY_PACKAGES.core;
    realPackages.push(`${core.npm}@${core.version}`);
    writePkg(join(tpRoot, "core"), TP_CORE_NAME, thirdPartyRealSrc(core.sideEffectImport));

    const markers = [core.marker];
    const extraLines: string[] = [];
    for (let i = 0; i < extras; i++) {
      const spec = REAL_THIRD_PARTY_PACKAGES.extras[i];
      if (!spec) {
        throw new Error(`No real 3p extra catalog entry for index ${i}`);
      }
      realPackages.push(`${spec.npm}@${spec.version}`);
      markers.push(spec.marker);
      writePkg(
        join(tpRoot, `extra-${i}`),
        tpExtraName(i),
        thirdPartyRealSrc(spec.sideEffectImport),
      );
      extraLines.push(`import "${tpExtraName(i)}";`);
    }

    return {
      coreImport: `import "${TP_CORE_NAME}";\n`,
      extraImports: extraLines.length ? `${extraLines.join("\n")}\n` : "",
      markers,
      realPackages,
    };
  }

  writePkg(
    join(tpRoot, "core"),
    TP_CORE_NAME,
    thirdPartyStubSrc(TP_CORE_MARKER, config.bytesPerPackage),
  );

  const markers = [TP_CORE_MARKER];
  const extraLines: string[] = [];
  for (let i = 0; i < extras; i++) {
    const name = tpExtraName(i);
    const marker = tpExtraMarker(i);
    markers.push(marker);
    writePkg(
      join(tpRoot, `extra-${i}`),
      name,
      thirdPartyStubSrc(marker, config.bytesPerPackage),
    );
    extraLines.push(`import "${name}";`);
  }

  return {
    coreImport: `import "${TP_CORE_NAME}";\n`,
    extraImports: extraLines.length ? `${extraLines.join("\n")}\n` : "",
    markers,
    realPackages,
  };
}

/** Resolve @lab/3p-* to generated (or smoke) source paths. */
export function resolveThirdPartyPackage(
  root: string,
  specifier: string,
  mode: "generated" | "smoke",
): string | undefined {
  const base =
    mode === "smoke"
      ? join(root, "packages/lab/smoke/third-party")
      : join(root, "packages/lab/generated/third-party");
  if (specifier === TP_CORE_NAME) {
    return join(base, "core/src/index.ts");
  }
  const m = /^@lab\/3p-extra-(\d+)$/.exec(specifier);
  if (m) {
    return join(base, `extra-${m[1]}/src/index.ts`);
  }
  return undefined;
}

/** Resolve @lab/3p-* to generated (or smoke) source paths. */
export function resolveThirdPartyPackage(
  root: string,
  specifier: string,
  mode: "generated" | "smoke",
): string | undefined {
  const base =
    mode === "smoke"
      ? join(root, "packages/lab/smoke/third-party")
      : join(root, "packages/lab/generated/third-party");
  if (specifier === TP_CORE_NAME) {
    return join(base, "core/src/index.ts");
  }
  const m = /^@lab\/3p-extra-(\d+)$/.exec(specifier);
  if (m) {
    return join(base, `extra-${m[1]}/src/index.ts`);
  }
  return undefined;
}
