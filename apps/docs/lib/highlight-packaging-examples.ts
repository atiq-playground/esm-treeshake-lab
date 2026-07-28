import {
  HIGHLIGHTED_PACKAGING_EXAMPLES,
  type HighlightedPackagingExample,
} from "@/lib/packaging-examples.highlighted";

export type { HighlightedPackagingExample };

/**
 * Precomputed at build time (see scripts/generate-packaging-highlights.ts).
 * Runtime must not import fumadocs-core/highlight / shiki — Workers free tier
 * is 3 MiB and the full Shiki bundle is ~10MB+ of grammars.
 */
export function getHighlightedPackagingExamples(): HighlightedPackagingExample[] {
  return [...HIGHLIGHTED_PACKAGING_EXAMPLES];
}
