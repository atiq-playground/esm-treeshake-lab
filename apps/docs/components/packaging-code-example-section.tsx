import { PackagingCodeExample } from "@/components/packaging-code-example";
import { highlightPackagingExamples } from "@/lib/highlight-packaging-examples";

/** Server: Shiki-highlight snippets, then hand HTML to the client tab UI. */
export async function PackagingCodeExampleSection() {
  const examples = await highlightPackagingExamples();
  return <PackagingCodeExample examples={examples} />;
}
