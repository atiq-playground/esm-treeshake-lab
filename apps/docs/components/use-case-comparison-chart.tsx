"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { UseCaseComparisonRow } from "@/lib/use-case-comparison";

type Props = {
  rows: UseCaseComparisonRow[];
};

function formatKbTick(value: number): string {
  if (value >= 1024) {
    return `${(value / 1024).toFixed(value >= 10240 ? 0 : 1)} MB`;
  }
  if (value >= 1) {
    return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} KB`;
  }
  return `${Math.round(value * 1024)} B`;
}

function CaseTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="middle"
      fill="var(--text-secondary)"
      fontSize={11}
      fontFamily="var(--font-mono)"
    >
      {payload?.value ?? ""}
    </text>
  );
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: UseCaseComparisonRow }>;
}) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  return (
    <div className="max-w-xs border border-[color:var(--border-visible)] bg-[color:var(--surface)] px-3 py-2 font-[family-name:var(--font-mono)] text-[length:var(--caption)] text-[color:var(--text-primary)]">
      <p className="lab-label mb-1">{row.plainTitle}</p>
      <p className="mb-2 text-[color:var(--text-secondary)]">{row.plainBlurb}</p>
      <p>Load everything: {row.singletonPrimary}</p>
      <p>Only what you use: {row.esmPrimary}</p>
      <p>
        {row.bytesSavedPct}% smaller · saved {row.sizeSavedPrimary}
      </p>
      <p className="mt-1 text-[color:var(--text-secondary)]">{row.plainMeta}</p>
    </div>
  );
}

export function UseCaseComparisonChart({ rows }: Props) {
  return (
    <div className="h-72 w-full sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          margin={{ top: 28, right: 8, left: 0, bottom: 12 }}
          barCategoryGap="28%"
          barGap={4}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="0"
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "var(--border-visible)" }}
            interval={0}
            height={48}
            tickMargin={16}
            tick={<CaseTick />}
          />
          <YAxis
            scale="log"
            domain={[0.1, "auto"]}
            allowDataOverflow
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{
              fill: "var(--text-secondary)",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
            }}
            tickFormatter={formatKbTick}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: "var(--surface-raised)" }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="square"
            wrapperStyle={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-secondary)",
              paddingBottom: 8,
            }}
          />
          <Bar
            dataKey="singletonKb"
            name="Load everything"
            fill="var(--text-display)"
            radius={0}
            maxBarSize={36}
          />
          <Bar
            dataKey="esmKb"
            name="Only what you use"
            fill="var(--success)"
            radius={0}
            maxBarSize={36}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
