import { claudeCode, run, type RunOptions, type RunResult, type SandboxProvider } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { pathToFileURL } from "node:url";

/**
 * Sandbox provider factories keyed by the `SANDCASTLE_SANDBOX` env var.
 * Docker is the default (local dev and the AFK Action's runner). This map is
 * the single seam to extend when a cloud provider (e.g. Vercel) is needed.
 * add an entry here, nothing else in this file changes.
 */
const SANDBOX_PROVIDERS: Record<string, (imageName?: string) => SandboxProvider> = {
  docker: (imageName) => docker(imageName ? { imageName } : undefined),
};

export function resolveSandboxProvider(
  name: string = process.env.SANDCASTLE_SANDBOX ?? "docker",
  imageName: string | undefined = process.env.SANDCASTLE_IMAGE_NAME,
): SandboxProvider {
  const factory = SANDBOX_PROVIDERS[name];
  if (!factory) {
    throw new Error(
      `Unknown sandbox provider "${name}". Supported: ${Object.keys(SANDBOX_PROVIDERS).join(", ")}`,
    );
  }
  return factory(imageName);
}

const PROMPT_FILE = ".sandcastle/prompt.md";
const DEFAULT_MODEL = "claude-opus-4-8";
const DEFAULT_MAX_ITERATIONS = 5;

export type OrchestrateOptions = {
  readonly issueNumber: string;
  readonly sandbox?: SandboxProvider;
  readonly model?: string;
  readonly maxIterations?: number;
};

export function buildRunOptions(options: OrchestrateOptions): RunOptions {
  const {
    issueNumber,
    sandbox = resolveSandboxProvider(),
    model = DEFAULT_MODEL,
    maxIterations = DEFAULT_MAX_ITERATIONS,
  } = options;

  if (!issueNumber.trim()) {
    throw new Error("issueNumber is required to build sandcastle run options");
  }

  return {
    agent: claudeCode(model),
    sandbox,
    branchStrategy: { type: "branch", branch: `agent/issue-${issueNumber}` },
    promptFile: PROMPT_FILE,
    promptArgs: { ISSUE_NUMBER: issueNumber },
    maxIterations,
    name: `issue-${issueNumber}`,
  };
}

export function orchestrate(options: OrchestrateOptions): Promise<RunResult> {
  return run(buildRunOptions(options));
}

function parseIssueNumber(argv: readonly string[]): string {
  const issueNumber = argv[2] ?? process.env.ISSUE_NUMBER;
  if (!issueNumber) {
    throw new Error(
      "Usage: bun run orchestrate <issue-number>  (or set ISSUE_NUMBER)",
    );
  }
  return issueNumber;
}

async function main(): Promise<void> {
  const issueNumber = parseIssueNumber(process.argv);
  const result = await orchestrate({ issueNumber });

  console.log(`branch: ${result.branch}`);
  console.log(`commits: ${result.commits.length}`);
  console.log(
    `completionSignal: ${result.completionSignal ?? "(none: hit maxIterations without one)"}`,
  );
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
