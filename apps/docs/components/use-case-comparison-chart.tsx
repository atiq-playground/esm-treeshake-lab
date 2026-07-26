"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
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

type ChartRow = UseCaseComparisonRow & {
  singletonKb: number;
  esmKb: number;
  /** Plot height for ESM; floored so hairline wins stay visible. */
  esmKbPlot: number;
  factorLabel: string;
};

/** ~1.5% of axis — enough to see, labels carry the real KB. */
const STUB_FRACTION = 0.015;

function toChartRows(rows: UseCaseComparisonRow[], topKb: number): ChartRow[] {
  const stubKb = Math.max(topKb * STUB_FRACTION, 8);
  return rows.map((row) => {
    const singletonKb = row.singletonBytes / 1024;
    const esmKb = row.esmBytes / 1024;
    const factor =
      row.singletonVsEsmFactor ??
      (esmKb === 0 ? 0 : singletonKb / esmKb);
    const factorLabel =
      factor >= 100
        ? `${Math.round(factor)}×`
        : factor >= 10
          ? `${factor.toFixed(0)}×`
          : `${factor.toFixed(1)}×`;
    return {
      ...row,
      singletonKb,
      esmKb,
      esmKbPlot: Math.max(esmKb, stubKb),
      factorLabel,
    };
  });
}

function formatKbTick(value: number): string {
  if (value === 0) return "0 KB";
  if (value >= 1) return `${Math.round(value)} KB`;
  return `${value.toFixed(1)} KB`;
}

function formatBarKb(bytes: number): string {
  const kb = bytes / 1024;
  if (kb >= 100) return `${Math.round(kb)} KB`;
  if (kb >= 10) return `${kb.toFixed(0)} KB`;
  if (kb >= 1) return `${kb.toFixed(1)} KB`;
  return `${Math.round(bytes)} B`;
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
  payload?: Array<{ payload: ChartRow }>;
}) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  return (
    <div className="max-w-xs border border-[color:var(--border-visible)] bg-[color:var(--surface)] px-3 py-2 font-[family-name:var(--font-mono)] text-[length:var(--caption)] text-[color:var(--text-primary)]">
      <p className="lab-label mb-1">{row.plainTitle}</p>
      <p className="mb-2 text-[color:var(--text-secondary)]">{row.plainBlurb}</p>
      <p className="flex items-baseline gap-2">
        <span
          className="inline-block h-2.5 w-2.5 shrink-0"
          style={{ background: "var(--text-display)" }}
          aria-hidden
        />
        <span>
          <span style={{ color: "var(--text-display)" }}>Load everything</span>
          {": "}
          {row.singletonPrimary}
        </span>
      </p>
      <p className="flex items-baseline gap-2">
        <span
          className="inline-block h-2.5 w-2.5 shrink-0"
          style={{ background: "var(--success)" }}
          aria-hidden
        />
        <span>
          <span style={{ color: "var(--success)" }}>Only what you use</span>
          {": "}
          {row.esmPrimary}
        </span>
      </p>
      <p className="mt-1">
        {row.bytesSavedPct}% smaller · {row.factorLabel} · saved{" "}
        {row.sizeSavedPrimary}
      </p>
      <p className="mt-1 text-[color:var(--text-secondary)]">{row.plainMeta}</p>
    </div>
  );
}

function SingletonLabel(props: {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  index?: number;
  payload?: ChartRow;
}) {
  const { x = 0, y = 0, width = 0, payload } = props;
  if (!payload) return null;
  const cx = Number(x) + Number(width) / 2;
  const cy = Number(y);
  return (
    <text
      x={cx}
      y={cy}
      dy={-6}
      textAnchor="middle"
      fill="var(--text-secondary)"
      fontSize={10}
      fontFamily="var(--font-mono)"
    >
      {formatBarKb(payload.singletonBytes)}
    </text>
  );
}

function EsmLabel(props: {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  index?: number;
  payload?: ChartRow;
}) {
  const { x = 0, y = 0, width = 0, payload } = props;
  if (!payload) return null;
  const cx = Number(x) + Number(width) / 2;
  const cy = Number(y);
  return (
    <text
      x={cx}
      y={cy}
      dy={-6}
      textAnchor="middle"
      fill="var(--success)"
      fontSize={10}
      fontFamily="var(--font-mono)"
    >
      <tspan x={cx} dy={0}>
        {formatBarKb(payload.esmBytes)}
      </tspan>
      <tspan x={cx} dy={12} fill="var(--text-secondary)">
        {payload.factorLabel}
      </tspan>
    </text>
  );
}

export function UseCaseComparisonChart({ rows }: Props) {
  const maxKb = Math.max(
    ...rows.map((r) => r.singletonBytes / 1024),
    0.001,
  );
  const top = Math.ceil(maxKb / 100) * 100;
  const data = toChartRows(rows, top);

  return (
    <div className="h-80 w-full sm:h-96">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 36, right: 8, left: 4, bottom: 12 }}
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
            domain={[0, top]}
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
          >
            <LabelList content={<SingletonLabel />} />
          </Bar>
          <Bar
            dataKey="esmKbPlot"
            name="Only what you use"
            fill="var(--success)"
            radius={0}
            maxBarSize={36}
          >
            <LabelList content={<EsmLabel />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
