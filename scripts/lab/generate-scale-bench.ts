/**
 * Generate N singleton + ESM stub packages for the scale bench.
 *
 * Usage:
 *   bun run scripts/lab/generate-scale-bench.ts --n=100
 *   bun run scripts/lab/generate-scale-bench.ts --n=100 --fns=20
 *   bun run scripts/lab/generate-scale-bench.ts --n=100 --fns=20 --cycles
 *   bun run scripts/lab/generate-scale-bench.ts --n=3 --smoke
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");

function argValue(flag: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit?.slice(flag.length + 1);
}

const smoke = process.argv.includes("--smoke");
const cycles = process.argv.includes("--cycles");
const n = Number(argValue("--n") ?? (smoke ? "3" : "100"));
const fns = Number(argValue("--fns") ?? "2");
const caseName = argValue("--case") ?? (cycles ? "cycles" : fns > 2 ? "wide" : "baseline");

if (!Number.isFinite(n) || n < 1 || n > 10000) {
  console.error("Invalid --n (1..10000)");
  process.exit(2);
}
if (!Number.isFinite(fns) || fns < 2 || fns > 200) {
  console.error("Invalid --fns (2..200)");
  process.exit(2);
}
if (smoke && (fns !== 2 || cycles)) {
  console.error("Smoke packages are UC1 only (fns=2, no cycles)");
  process.exit(2);
}

const ballast = "x".repeat(2048);

function unusedMethodName(k: number, totalFns: number): string {
  // UC1 parity: single unused is named `unused` (marker *_UNUSED).
  if (totalFns === 2) return "unused";
  return `unused_${k}`;
}

function unusedMarker(prefix: string, i: number, k: number, totalFns: number): string {
  if (totalFns === 2) return `${prefix}_SVC_${i}_UNUSED`;
  return `${prefix}_SVC_${i}_UNUSED_${k}`;
}

function singletonSrc(
  i: number,
  markerPrefix: string,
  pkgName: string,
  totalFns: number,
  withCycles: boolean,
  totalN: number,
): string {
  const used = `${markerPrefix}_SVC_${i}_USED`;
  const key = `LabSingletonSvc${i}`;
  const next = (i + 1) % totalN;
  const nextName = pkgName.replace(/-\d+$/, `-${next}`);

  const unusedMethods = Array.from({ length: totalFns - 1 }, (_, idx) => {
    const k = idx + 1;
    const name = unusedMethodName(k, totalFns);
    const marker = unusedMarker(markerPrefix, i, k, totalFns);
    return `
  ${name}(): { marker: string; ballast: string } {
    const payload = {
      marker: "${marker}",
      ballast: "${ballast}",
    };
    void payload;
    return payload;
  }`;
  }).join("\n");

  // Ring edge: bare import + real top-level side effect on every module.
  // Named `void cycleId` / side-effect-free deps are DCE'd by esbuild.
  const cycleImport = withCycles ? `import "${nextName}";\n` : "";
  const cycleTouch = withCycles
    ? `(globalThis as typeof globalThis & { __LAB_CYCLE_TOUCH__?: number }).__LAB_CYCLE_TOUCH__ =
  ((globalThis as typeof globalThis & { __LAB_CYCLE_TOUCH__?: number }).__LAB_CYCLE_TOUCH__ ?? 0) + 1;
`
    : "";
  const cycleExport = withCycles ? `\nexport const cycleId = ${i};\n` : "";

  return `${cycleImport}${cycleTouch}import {
  getRoot,
  registerPublicService,
  type LabSingletonConfig,
} from "@lab/singleton-services";

class Svc${i}Impl {
  private baseUrl = "";

  configure(cfg: LabSingletonConfig): void {
    this.baseUrl = cfg.baseUrl;
  }

  used(): string {
    void this.baseUrl;
    return "${used}";
  }
${unusedMethods}
}

type RootBag = typeof globalThis & { ${key}?: Svc${i}Impl };

const root = getRoot() as RootBag;
let inst = root.${key};
if (!inst) {
  inst = new Svc${i}Impl();
  root.${key} = inst;
  registerPublicService(inst);
}

export const Svc${i}Service = inst;
export type { Svc${i}Impl };
${cycleExport}`;
}

function esmSrc(
  i: number,
  markerPrefix: string,
  pkgName: string,
  totalFns: number,
  withCycles: boolean,
  totalN: number,
): string {
  const usedM = `${markerPrefix}_SVC_${i}_USED`;
  const next = (i + 1) % totalN;
  const nextName = pkgName.replace(/-\d+$/, `-${next}`);

  const unusedBlocks = Array.from({ length: totalFns - 1 }, (_, idx) => {
    const k = idx + 1;
    const name = unusedMethodName(k, totalFns);
    const marker = unusedMarker(markerPrefix, i, k, totalFns);
    const payload = `UNUSED_PAYLOAD_${k}`;
    return `const ${payload} = {
  marker: "${marker}",
  ballast: "${ballast}",
};

export function ${name}(): typeof ${payload} {
  void ${payload};
  return ${payload};
}
`;
  }).join("\n");

  const nsMembers = [
    "used",
    ...Array.from({ length: totalFns - 1 }, (_, idx) =>
      unusedMethodName(idx + 1, totalFns),
    ),
  ].join(",\n  ");

  // Ring edge: bare import + real top-level side effect on every module.
  // Named `void cycleId` / side-effect-free deps are DCE'd by esbuild.
  const cycleImport = withCycles ? `import "${nextName}";\n` : "";
  const cycleTouch = withCycles
    ? `(globalThis as typeof globalThis & { __LAB_CYCLE_TOUCH__?: number }).__LAB_CYCLE_TOUCH__ =
  ((globalThis as typeof globalThis & { __LAB_CYCLE_TOUCH__?: number }).__LAB_CYCLE_TOUCH__ ?? 0) + 1;
`
    : "";
  const cycleExport = withCycles ? `\nexport const cycleId = ${i};\n` : "";

  return `${cycleImport}${cycleTouch}${unusedBlocks}
export function used(): string {
  return "${usedM}";
}

export const Svc${i} = {
  ${nsMembers},
};
${cycleExport}`;
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

const singletonMarker = "EXECUTING_LAB_SINGLETON";
const esmMarker = "EXECUTING_LAB_ESM";

if (smoke) {
  const smokeRoot = join(ROOT, "packages/lab/smoke");
  for (let i = 0; i < n; i++) {
    const sName = `@lab/smoke-singleton-svc-${i}`;
    const eName = `@lab/smoke-esm-svc-${i}`;
    writePkg(
      join(smokeRoot, "singleton", `svc-${i}`),
      sName,
      singletonSrc(i, singletonMarker, sName, 2, false, n),
    );
    writePkg(
      join(smokeRoot, "esm", `svc-${i}`),
      eName,
      esmSrc(i, esmMarker, eName, 2, false, n),
    );
  }
  const registerDir = join(smokeRoot, "singleton-register");
  mkdirSync(join(registerDir, "src"), { recursive: true });
  const imports = Array.from(
    { length: n },
    (_, i) => `import "@lab/smoke-singleton-svc-${i}";`,
  ).join("\n");
  writeFileSync(
    join(registerDir, "package.json"),
    JSON.stringify(
      {
        name: "@lab/smoke-singleton-register",
        version: "0.0.0",
        private: true,
        type: "module",
        exports: { ".": "./src/index.ts" },
      },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    join(registerDir, "src/index.ts"),
    `${imports}
export { registerPublicServices } from "@lab/singleton-services";
export { Svc0Service } from "@lab/smoke-singleton-svc-0";
`,
  );
  console.log(`Wrote smoke packages n=${n} under packages/lab/smoke`);
  process.exit(0);
}

const genRoot = join(ROOT, "packages/lab/generated");
rmSync(genRoot, { recursive: true, force: true });

for (let i = 0; i < n; i++) {
  const sName = `@lab/singleton-svc-${i}`;
  const eName = `@lab/esm-svc-${i}`;
  writePkg(
    join(genRoot, "singleton", `svc-${i}`),
    sName,
    singletonSrc(i, singletonMarker, sName, fns, cycles, n),
  );
  writePkg(
    join(genRoot, "esm", `svc-${i}`),
    eName,
    esmSrc(i, esmMarker, eName, fns, cycles, n),
  );
}

const registerDir = join(genRoot, "singleton", "register");
mkdirSync(join(registerDir, "src"), { recursive: true });
const imports = Array.from(
  { length: n },
  (_, i) => `import "@lab/singleton-svc-${i}";`,
).join("\n");
writeFileSync(
  join(registerDir, "package.json"),
  JSON.stringify(
    {
      name: "@lab/singleton-register",
      version: "0.0.0",
      private: true,
      type: "module",
      exports: { ".": "./src/index.ts" },
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  join(registerDir, "src/index.ts"),
  `${imports}
export { registerPublicServices } from "@lab/singleton-services";
export { Svc0Service } from "@lab/singleton-svc-0";
`,
);

writeFileSync(
  join(genRoot, "meta.json"),
  JSON.stringify(
    {
      n,
      fns,
      cycles,
      case: caseName,
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  join(genRoot, "n.json"),
  JSON.stringify({ n, generatedAt: new Date().toISOString() }, null, 2) + "\n",
);

console.log(
  `Wrote generated packages n=${n} fns=${fns} cycles=${cycles} case=${caseName} under packages/lab/generated`,
);
