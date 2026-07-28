type Props = {
  /** e.g. "4.2 MB" — singleton bag label */
  singletonSize: string;
  /** e.g. "448.7 KB" — ESM bag label */
  esmSize: string;
  /** Size factor, e.g. 9.3 — drives honest bag area */
  factor: number;
  /** Short case name for the caption, e.g. "Fat domain modules" */
  caseTitle: string;
};

type Dot = "live" | "out";

/** Three packages × five exports — singleton keeps every export live. */
const PKG_SINGLETON: Dot[][] = [
  ["live", "live", "live", "live", "live"],
  ["live", "live", "live", "live", "live"],
  ["live", "live", "live", "live", "live"],
];

/** Same boxes; only call-site exports stay lit. */
const PKG_ESM: Dot[][] = [
  ["live", "live", "out", "out", "out"],
  ["live", "out", "out", "out", "out"],
  ["live", "live", "live", "out", "out"],
];

/**
 * Area-honest bags: ESM is the base; singleton scales with √factor
 * (area ∝ factor). Cap so layout stays readable at huge wins.
 */
function bagSize(factor: number): {
  singletonW: number;
  singletonH: number;
  esmW: number;
  esmH: number;
} {
  const esmW = 44;
  const esmH = 52;
  const scale = Math.sqrt(Math.max(factor, 1));
  const singletonW = Math.min(168, Math.max(esmW * 1.6, esmW * scale));
  const singletonH = Math.min(168, Math.max(esmH * 1.5, esmH * scale));
  return { singletonW, singletonH, esmW, esmH };
}

function formatFactor(factor: number): string {
  if (factor >= 100) return `${Math.round(factor)}×`;
  if (factor >= 10) return `${factor.toFixed(0)}×`;
  return `${factor.toFixed(1)}×`;
}

function PackageBox({
  dots,
  x,
  y,
  stroke,
  liveFill,
}: {
  dots: Dot[];
  x: number;
  y: number;
  stroke: string;
  liveFill: string;
}) {
  const boxW = 56;
  const boxH = 48;
  const cols = 5;
  const r = 3.2;
  const gap = 8.5;
  const startX = x + 10;
  const startY = y + 14;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={boxW}
        height={boxH}
        rx={1}
        fill="var(--surface)"
        stroke={stroke}
        strokeWidth={1.5}
      />
      {dots.map((dot, i) => {
        const cx = startX + (i % cols) * gap;
        const cy = startY + Math.floor(i / cols) * gap;
        if (dot === "live") {
          return <circle key={i} cx={cx} cy={cy} r={r} fill={liveFill} />;
        }
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="transparent"
            stroke="var(--text-disabled)"
            strokeWidth={1.25}
          />
        );
      })}
    </g>
  );
}

function BundleBag({
  x,
  y,
  width,
  height,
  fill,
  strokeWidth,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  strokeWidth: number;
}) {
  const mouth = Math.min(18, width * 0.2);
  const top = y;
  const bottom = y + height;
  const left = x;
  const right = x + width;
  const d = [
    `M ${left + mouth} ${top}`,
    `Q ${left} ${top + height * 0.12} ${left} ${top + height * 0.4}`,
    `Q ${left} ${bottom} ${left + width / 2} ${bottom}`,
    `Q ${right} ${bottom} ${right} ${top + height * 0.4}`,
    `Q ${right} ${top + height * 0.12} ${right - mouth} ${top}`,
    `Z`,
  ].join(" ");

  return (
    <path
      d={d}
      fill={fill}
      fillOpacity={0.16}
      stroke={fill}
      strokeWidth={strokeWidth}
    />
  );
}

/**
 * Teaching diagram: packages = boxes, exports = dots, Worker artifact = bag.
 * Left: hub lights every box → huge bag. Right: few lit dots → tiny bag.
 */
export function PackagingMetaphor({
  singletonSize,
  esmSize,
  factor,
  caseTitle,
}: Props) {
  const bags = bagSize(factor);
  const factorText = formatFactor(factor);

  const panelW = 300;
  const panelH = 268;
  const gap = 28;
  const totalW = panelW * 2 + gap;
  const boxY = 78;
  const bagFloor = 248;
  const boxesX = [52, 120, 188];

  const singletonBagX = (panelW - bags.singletonW) / 2;
  const esmBagX = (panelW - bags.esmW) / 2;

  return (
    <figure className="lab-metaphor flex flex-col gap-3">
      <figcaption className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        <p className="lab-label">□ box · ● shipped · ○ shaken · bag = bytes</p>
        <p className="lab-mono text-[length:var(--caption)] text-[color:var(--text-secondary)]">
          {caseTitle} · {factorText}
        </p>
      </figcaption>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${totalW} ${panelH}`}
          role="img"
          aria-label={`Package boxes with export dots. Singleton hub ships ${singletonSize}; selective ESM ships ${esmSize} — about ${factorText} smaller.`}
          className="mx-auto h-auto w-full max-w-3xl"
        >
          {/* ── Singleton ── */}
          <g className="lab-metaphor-panel">
            <text
              x={0}
              y={18}
              fill="var(--accent)"
              fontSize={12}
              fontFamily="var(--font-mono)"
              letterSpacing="0.1em"
            >
              SINGLETON
            </text>
            <text
              x={0}
              y={36}
              fill="var(--text-secondary)"
              fontSize={11}
              fontFamily="var(--font-sans)"
            >
              hub → every box lit → huge bag
            </text>

            {/* Hub */}
            <rect
              x={0}
              y={boxY + 10}
              width={36}
              height={28}
              rx={1}
              fill="var(--accent)"
              fillOpacity={0.14}
              stroke="var(--accent)"
              strokeWidth={1.75}
            />
            <text
              x={18}
              y={boxY + 28}
              textAnchor="middle"
              fill="var(--accent)"
              fontSize={9}
              fontFamily="var(--font-mono)"
              letterSpacing="0.08em"
            >
              HUB
            </text>

            {boxesX.map((x, i) => (
              <line
                key={`spoke-${i}`}
                x1={36}
                y1={boxY + 24}
                x2={x}
                y2={boxY + 24}
                stroke="var(--accent)"
                strokeWidth={1.25}
                strokeOpacity={0.5}
                className="lab-metaphor-spoke"
              />
            ))}

            {PKG_SINGLETON.map((dots, i) => (
              <PackageBox
                key={i}
                dots={dots}
                x={boxesX[i]!}
                y={boxY}
                stroke="var(--accent)"
                liveFill="var(--accent)"
              />
            ))}

            {/* Funnel ticks into bag */}
            <line
              x1={panelW / 2}
              y1={boxY + 52}
              x2={panelW / 2}
              y2={bagFloor - bags.singletonH - 4}
              stroke="var(--accent)"
              strokeWidth={1}
              strokeOpacity={0.35}
              strokeDasharray="3 4"
            />

            <BundleBag
              x={singletonBagX}
              y={bagFloor - bags.singletonH}
              width={bags.singletonW}
              height={bags.singletonH}
              fill="var(--accent)"
              strokeWidth={2.5}
            />
            <text
              x={panelW / 2}
              y={bagFloor - bags.singletonH / 2 + 5}
              textAnchor="middle"
              fill="var(--accent)"
              fontSize={14}
              fontFamily="var(--font-mono)"
              fontWeight={500}
            >
              {singletonSize}
            </text>
          </g>

          {/* ── ESM ── */}
          <g
            className="lab-metaphor-panel"
            transform={`translate(${panelW + gap}, 0)`}
          >
            <text
              x={0}
              y={18}
              fill="var(--success)"
              fontSize={12}
              fontFamily="var(--font-mono)"
              letterSpacing="0.1em"
            >
              ESM
            </text>
            <text
              x={0}
              y={36}
              fill="var(--text-secondary)"
              fontSize={11}
              fontFamily="var(--font-sans)"
            >
              few lit dots → tiny bag
            </text>

            {PKG_ESM.map((dots, i) => (
              <PackageBox
                key={i}
                dots={dots}
                x={boxesX[i]!}
                y={boxY}
                stroke="var(--success)"
                liveFill="var(--success)"
              />
            ))}

            <line
              x1={panelW / 2}
              y1={boxY + 52}
              x2={panelW / 2}
              y2={bagFloor - bags.esmH - 4}
              stroke="var(--success)"
              strokeWidth={1}
              strokeOpacity={0.35}
              strokeDasharray="3 4"
            />

            <BundleBag
              x={esmBagX}
              y={bagFloor - bags.esmH}
              width={bags.esmW}
              height={bags.esmH}
              fill="var(--success)"
              strokeWidth={1.5}
            />
            <text
              x={panelW / 2}
              y={bagFloor - bags.esmH - 10}
              textAnchor="middle"
              fill="var(--success)"
              fontSize={14}
              fontFamily="var(--font-mono)"
              fontWeight={500}
            >
              {esmSize}
            </text>
          </g>
        </svg>
      </div>
    </figure>
  );
}

type CycleProps = {
  className?: string;
};

/** Compact ring: singleton lights the cycle; ESM only lights imports. */
export function CycleRingMetaphor({ className }: CycleProps) {
  const cx = 110;
  const cy = 58;
  const r = 34;
  const n = 4;
  const boxes = Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { x: cx + Math.cos(a) * r - 14, y: cy + Math.sin(a) * r - 11 };
  });

  return (
    <figure className={`flex flex-col gap-2 ${className ?? ""}`}>
      <p className="lab-label">
        Cycles · hub can light neighbors you never call
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <svg
          viewBox="0 0 220 118"
          role="img"
          aria-label="Four packages in a ring, all lit by a singleton hub"
          className="h-auto w-full max-w-[14rem]"
        >
          <text
            x={0}
            y={12}
            fill="var(--accent)"
            fontSize={10}
            fontFamily="var(--font-mono)"
            letterSpacing="0.08em"
          >
            SINGLETON
          </text>
          {boxes.map((b, i) => {
            const next = boxes[(i + 1) % n]!;
            return (
              <line
                key={`l-${i}`}
                x1={b.x + 14}
                y1={b.y + 11}
                x2={next.x + 14}
                y2={next.y + 11}
                stroke="var(--accent)"
                strokeWidth={1.25}
                strokeOpacity={0.45}
              />
            );
          })}
          {boxes.map((b, i) => (
            <g key={i}>
              <rect
                x={b.x}
                y={b.y}
                width={28}
                height={22}
                rx={1}
                fill="var(--surface)"
                stroke="var(--accent)"
                strokeWidth={1.25}
              />
              <circle cx={b.x + 8} cy={b.y + 11} r={2.2} fill="var(--accent)" />
              <circle
                cx={b.x + 14}
                cy={b.y + 11}
                r={2.2}
                fill="var(--accent)"
              />
              <circle
                cx={b.x + 20}
                cy={b.y + 11}
                r={2.2}
                fill="var(--accent)"
              />
            </g>
          ))}
        </svg>
        <svg
          viewBox="0 0 220 118"
          role="img"
          aria-label="Four packages in a ring; only imported packages stay lit"
          className="h-auto w-full max-w-[14rem]"
        >
          <text
            x={0}
            y={12}
            fill="var(--success)"
            fontSize={10}
            fontFamily="var(--font-mono)"
            letterSpacing="0.08em"
          >
            ESM
          </text>
          {boxes.map((b, i) => {
            const next = boxes[(i + 1) % n]!;
            return (
              <line
                key={`l-${i}`}
                x1={b.x + 14}
                y1={b.y + 11}
                x2={next.x + 14}
                y2={next.y + 11}
                stroke="var(--border-visible)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            );
          })}
          {boxes.map((b, i) => {
            const lit = i === 0 || i === 1;
            const stroke = lit ? "var(--success)" : "var(--text-disabled)";
            return (
              <g key={i} opacity={lit ? 1 : 0.4}>
                <rect
                  x={b.x}
                  y={b.y}
                  width={28}
                  height={22}
                  rx={1}
                  fill="var(--surface)"
                  stroke={stroke}
                  strokeWidth={1.25}
                />
                <circle
                  cx={b.x + 8}
                  cy={b.y + 11}
                  r={2.2}
                  fill={lit ? "var(--success)" : "transparent"}
                  stroke={lit ? undefined : "var(--text-disabled)"}
                  strokeWidth={lit ? 0 : 1}
                />
                <circle
                  cx={b.x + 14}
                  cy={b.y + 11}
                  r={2.2}
                  fill={lit ? "var(--success)" : "transparent"}
                  stroke={lit ? undefined : "var(--text-disabled)"}
                  strokeWidth={lit ? 0 : 1}
                />
                <circle
                  cx={b.x + 20}
                  cy={b.y + 11}
                  r={2.2}
                  fill="transparent"
                  stroke="var(--text-disabled)"
                  strokeWidth={1}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </figure>
  );
}
