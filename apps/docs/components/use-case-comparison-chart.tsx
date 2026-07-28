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
  /** Plot length for ESM; floored so hairline wins stay visible. */
  esmKbPlot: number;
  factorLabel: string;
};

/** Recharts Label content props — Cartesian viewBox only for our bar labels. */
type LabelGeom = {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  index?: number;
  viewBox?: unknown;
};

/** ~1.5% of axis — enough to see; labels carry the real size. */
const STUB_FRACTION = 0.015;
/** Gap between bar end and size/× text in the right gutter. */
const LABEL_GUTTER = 10;

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
  if (value >= 1024) return `${(value / 1024).toFixed(1)} MB`;
  if (value >= 1) return `${Math.round(value)} KB`;
  return `${value.toFixed(1)} KB`;
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
      textAnchor="end"
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
          style={{ background: "var(--accent)" }}
          aria-hidden
        />
        <span>
          <span style={{ color: "var(--accent)" }}>Load everything</span>
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

/**
 * Recharts 3 LabelList strips `payload` via svgPropertiesAndEvents.
 * Always resolve the row from `index` + chart data — never from payload.
 */
function asBox(
  viewBox: unknown,
): { x?: number | string; y?: number | string; width?: number | string; height?: number | string } | null {
  if (viewBox == null || typeof viewBox !== "object") return null;
  return viewBox as {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
  };
}

function barEnd(props: LabelGeom): { x: number; y: number } | null {
  const box = asBox(props.viewBox);
  const x0 = Number(box?.x ?? props.x);
  const y0 = Number(box?.y ?? props.y);
  const w = Number(box?.width ?? props.width);
  const h = Number(box?.height ?? props.height);
  if (![x0, y0, w, h].every(Number.isFinite)) return null;
  return {
    x: x0 + w + LABEL_GUTTER,
    y: y0 + h / 2,
  };
}

export function UseCaseComparisonChart({ rows }: Props) {
  const maxKb = Math.max(
    ...rows.map((r) => r.singletonBytes / 1024),
    0.001,
  );
  const top = Math.ceil(maxKb / 100) * 100;
  const data = toChartRows(rows, top);

  function SingletonLabel(props: LabelGeom) {
    const row =
      typeof props.index === "number" ? data[props.index] : undefined;
    const end = barEnd(props);
    if (!row || !end) return null;
    return (
      <text
        x={end.x}
        y={end.y}
        dominantBaseline="central"
        textAnchor="start"
        fill="var(--text-primary)"
        fontSize={12}
        fontFamily="var(--font-mono)"
        fontWeight={600}
      >
        {row.singletonPrimary}
      </text>
    );
  }

  function EsmLabel(props: LabelGeom) {
    const row =
      typeof props.index === "number" ? data[props.index] : undefined;
    const end = barEnd(props);
    if (!row || !end) return null;
    return (
      <text
        textAnchor="start"
        fontSize={12}
        fontFamily="var(--font-mono)"
        fontWeight={600}
      >
        <tspan
          x={end.x}
          y={end.y - 7}
          fill="var(--success)"
        >
          {row.esmPrimary}
        </tspan>
        <tspan
          x={end.x}
          y={end.y + 8}
          fill="var(--text-primary)"
        >
          {row.factorLabel}
        </tspan>
      </text>
    );
  }

  return (
    <div className="h-[28rem] w-full overflow-visible sm:h-[32rem]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 12, right: 96, left: 8, bottom: 12 }}
          barCategoryGap="22%"
          barGap={6}
        >
          <CartesianGrid
            horizontal={false}
            stroke="var(--border)"
            strokeDasharray="0"
          />
          <XAxis
            type="number"
            domain={[0, top]}
            tickLine={false}
            axisLine={{ stroke: "var(--border-visible)" }}
            tick={{
              fill: "var(--text-secondary)",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
            }}
            tickFormatter={formatKbTick}
          />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            width={88}
            tickMargin={8}
            tick={<CaseTick />}
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
            fill="var(--accent)"
            radius={0}
            maxBarSize={22}
          >
            <LabelList
              content={(props) => SingletonLabel(props as LabelGeom)}
            />
          </Bar>
          <Bar
            dataKey="esmKbPlot"
            name="Only what you use"
            fill="var(--success)"
            radius={0}
            maxBarSize={22}
          >
            <LabelList content={(props) => EsmLabel(props as LabelGeom)} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
