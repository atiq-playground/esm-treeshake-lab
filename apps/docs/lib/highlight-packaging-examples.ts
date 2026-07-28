import { getHighlighter } from "fumadocs-core/highlight";
import {
  PACKAGING_EXAMPLES,
  type PackagingLangId,
} from "@/lib/packaging-examples";

export type HighlightedPackagingExample = {
  id: PackagingLangId;
  label: string;
  why: string;
  badHtml: string;
  goodHtml: string;
};

const SHIKI_LANG: Record<PackagingLangId, string> = {
  typescript: "typescript",
  javascript: "javascript",
};

/** Server-only: highlight all packaging snippets once per request/build. */
export async function highlightPackagingExamples(): Promise<
  HighlightedPackagingExample[]
> {
  const highlighter = await getHighlighter("js", {
    langs: ["typescript", "javascript"],
    themes: ["github-light", "github-dark"],
  });

  return PACKAGING_EXAMPLES.map((ex) => {
    const lang = SHIKI_LANG[ex.id];
    const options = {
      lang,
      themes: {
        light: "github-light" as const,
        dark: "github-dark" as const,
      },
      defaultColor: false as const,
    };
    return {
      id: ex.id,
      label: ex.label,
      why: ex.why,
      badHtml: highlighter.codeToHtml(ex.bad, options),
      goodHtml: highlighter.codeToHtml(ex.good, options),
    };
  });
}
