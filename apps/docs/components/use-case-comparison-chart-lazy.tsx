"use client";

import dynamic from "next/dynamic";
import type { UseCaseComparisonRow } from "@/lib/use-case-comparison";
import { UseCaseComparisonChartSkeleton } from "@/components/use-case-comparison-chart-skeleton";

const UseCaseComparisonChart = dynamic(
  () =>
    import("@/components/use-case-comparison-chart").then(
      (mod) => mod.UseCaseComparisonChart,
    ),
  {
    ssr: false,
    loading: () => <UseCaseComparisonChartSkeleton />,
  },
);

type Props = {
  rows: UseCaseComparisonRow[];
};

export function UseCaseComparisonChartLazy({ rows }: Props) {
  return <UseCaseComparisonChart rows={rows} />;
}
