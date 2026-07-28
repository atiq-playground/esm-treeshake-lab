import { byteParts } from "./format-bytes";

/** Documented assumptions for measured → larger-N projections. */
export const SCALE_PROJECTION_ASSUMPTIONS = {
  singletonBytesLinearInN: {
    id: "singleton-bytes-linear-in-n",
    summary:
      "Singleton registry bytes scale roughly linearly with package count N when per-package surface (fns) stays fixed — confirmed by the N-ladder sweep for wide/partial.",
  },
  firstPartyGraphOnly: {
    id: "first-party-graph-only",
    summary:
      "Projections inherit lab scope: first-party stub graphs only. No graphql, DataLoader, ORMs, auth SDKs, or other third-party deps.",
  },
  thinCallSitesNotLandingShaped: {
    id: "thin-call-sites-not-landing",
    summary:
      "Scale sweep rows are mostly K=1 (or K=min(8,N)). Landing benches bind ~2–5 resolvers/package. Use sweep for singleton size/build cliffs; use landing for GraphQL-shaped ESM sizes.",
  },
} as const;

export type EvidenceKind = "measured" | "extrapolated" | "operator";

/**
 * Project a measured byte cost to another package count under
 * {@link SCALE_PROJECTION_ASSUMPTIONS.singletonBytesLinearInN}.
 */
export function projectLinearBytes(
  measuredBytes: number,
  measuredN: number,
  targetN: number,
): number {
  if (measuredN <= 0) {
    throw new Error(`measuredN must be > 0 (got ${measuredN})`);
  }
  return Math.round((measuredBytes / measuredN) * targetN);
}

export type ProjectedBytes = {
  bytes: number;
  primary: string;
  evidence: "extrapolated";
  assumptionId: string;
  note: string;
};

/** Format a linear-N projection for UI copy. */
export function formatProjectedBytes(input: {
  measuredBytes: number;
  measuredN: number;
  targetN: number;
}): ProjectedBytes {
  const bytes = projectLinearBytes(
    input.measuredBytes,
    input.measuredN,
    input.targetN,
  );
  const { primary } = byteParts(bytes);
  const assumption = SCALE_PROJECTION_ASSUMPTIONS.singletonBytesLinearInN;
  return {
    bytes,
    primary,
    evidence: "extrapolated",
    assumptionId: assumption.id,
    note: `Order-of-magnitude at N=${input.targetN}: linear in N from ${byteParts(input.measuredBytes).primary} @ N=${input.measuredN} (same fns/package; first-party stubs only).`,
  };
}
