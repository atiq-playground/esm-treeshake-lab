import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { QuickFacts } from "@/components/quick-facts";
import { RealisticBenchSummary } from "@/components/realistic-bench-summary";

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    QuickFacts,
    RealisticBenchSummary,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;
