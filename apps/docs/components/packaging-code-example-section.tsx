import { PackagingCodeExample } from "@/components/packaging-code-example";
import { getHighlightedPackagingExamples } from "@/lib/highlight-packaging-examples";

/** Server: serve pre-highlighted snippets to the client tab UI. */
export function PackagingCodeExampleSection() {
  const examples = getHighlightedPackagingExamples();
  return <PackagingCodeExample examples={examples} />;
}
