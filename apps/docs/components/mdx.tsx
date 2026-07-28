import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { QuickFacts } from "@/components/quick-facts";

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    QuickFacts,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;
