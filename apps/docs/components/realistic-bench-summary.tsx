import { loadRealisticVerifiedSummary } from "@/lib/benchmark";

/**
 * Research-only: Realistic GraphQL pipeline Last verified from committed JSON.
 * Homepage must not import this.
 */
export function RealisticBenchSummary() {
  const summary = loadRealisticVerifiedSummary();

  if (!summary.verified) {
    return (
      <p>
        <strong>Last verified:</strong> {summary.emptyMessage}
      </p>
    );
  }

  return (
    <div className="not-prose my-4 space-y-3 text-sm">
      <p>
        <strong>Last verified:</strong>{" "}
        {summary.lastVerified}
        {summary.githubRunUrl ? (
          <>
            {" "}
            (
            <a href={summary.githubRunUrl} className="underline">
              GitHub Actions run
            </a>
            )
          </>
        ) : null}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-fd-border">
              <th className="py-2 pr-4 font-medium">Metric</th>
              <th className="py-2 pr-4 font-medium">Singleton</th>
              <th className="py-2 font-medium">ESM</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-fd-border/60">
              <td className="py-2 pr-4">Bytes saved %</td>
              <td className="py-2 pr-4" colSpan={2}>
                {summary.bytesSavedPct != null
                  ? `${summary.bytesSavedPct}%`
                  : "—"}
              </td>
            </tr>
            {summary.coldPipelineTotalMs ? (
              <tr className="border-b border-fd-border/60">
                <td className="py-2 pr-4">Cold pipelineTotalMs</td>
                <td className="py-2 pr-4">
                  {summary.coldPipelineTotalMs.singleton}
                </td>
                <td className="py-2">{summary.coldPipelineTotalMs.esm}</td>
              </tr>
            ) : null}
            {summary.warmPipelineTotalMs ? (
              <tr className="border-b border-fd-border/60">
                <td className="py-2 pr-4">Warm pipelineTotalMs</td>
                <td className="py-2 pr-4">
                  {summary.warmPipelineTotalMs.singleton}
                </td>
                <td className="py-2">{summary.warmPipelineTotalMs.esm}</td>
              </tr>
            ) : null}
            {summary.requestP95Ms ? (
              <tr className="border-b border-fd-border/60">
                <td className="py-2 pr-4">Request p95 (ms)</td>
                <td className="py-2 pr-4">{summary.requestP95Ms.singleton}</td>
                <td className="py-2">{summary.requestP95Ms.esm}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p>
        Full report:{" "}
        <a href={summary.reportMdHref} className="underline">
          benchmark-realistic-latest.md
        </a>
      </p>
    </div>
  );
}
