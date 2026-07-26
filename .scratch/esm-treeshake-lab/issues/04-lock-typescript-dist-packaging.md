# Lock TypeScript dist packaging conventions

Type: grilling
Status: open
Blocked by: 02

## Question

What shared TypeScript packaging conventions do all `@service/*` packages follow so `tsc` → `dist/` preserves the ESM namespace tree-shake lab?

Lock: base `tsconfig` layout, per-package `compilerOptions` (module, moduleResolution, declaration, outDir), `package.json` `exports`/`types`/`main` pointing at `dist`, and how `@apps/web` references built packages. Incorporate findings from [Research Next + tsc namespace tree-shaking](./02-research-next-tsc-namespace-treeshake.md).
