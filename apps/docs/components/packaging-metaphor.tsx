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

const PKG_SINGLETON: Dot[][] = [
  ["live", "live", "live", "live", "live"],
  ["live", "live", "live", "live", "live"],
  ["live", "live", "live", "live", "live"],
];

const PKG_ESM: Dot[][] = [
  ["live", "live", "out", "out", "out"],
  ["live", "out", "out", "out", "out"],
  ["live", "live", "live", "out", "out"],
];

/** Area-honest bag height: ESM=base, singleton scales by factor (capped for layout). */
function bagHeights(factor: number): { singleton: number; esm: number } {
  const esm = 28;
  const maxSingleton = 140;
  const singleton = Math.min(
    maxSingleton,
    Math.max(esm * 1.4, esm * Math.sqrt(Math.max(factor, 1))),
  );
  return { singleton, esm };
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
  const boxW = 44;
  const boxH = 36;
  const cols = 5;
  const r = 2.6;
  const gap = 6.5;
  const startX = x + 7;
  const startY = y + 10;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={boxW}
        height={boxH}
        fill="transparent"
        stroke={stroke}
        strokeWidth={1.25}
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
            strokeWidth={1}
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
  const mouth = Math.min(14, width * 0.22);
  const top = y;
  const bottom = y + height;
  const left = x;
  const right = x + width;
  // Soft sack: wider mid, cinched mouth
  const d = [
    `M ${left + mouth} ${top}`,
    `Q ${left} ${top + height * 0.15} ${left} ${top + height * 0.45}`,
    `Q ${left} ${bottom} ${left + width / 2} ${bottom}`,
    `Q ${right} ${bottom} ${right} ${top + height * 0.45}`,
    `Q ${right} ${top + height * 0.15} ${right - mouth} ${top}`,
    `Z`,
  ].join(" ");

  return (
    <path
      d={d}
      fill={fill}
      fillOpacity={0.14}
      stroke={fill}
      strokeWidth={strokeWidth}
    />
  );
}

function formatFactor(factor: number): string {
  if (factor >= 100) return `${Math.round(factor)}×`;
  if (factor >= 10) return `${factor.toFixed(0)}×`;
  return `${factor.toFixed(1)}×`;
}

/**
 * Teaching diagram: packages = boxes, exports = dots, Worker artifact = bag.
 * Singleton lights every dot; ESM lights only call-site dots.
 */
export function PackagingMetaphor({
  singletonSize,
  esmSize,
  factor,
  caseTitle,
}: Props) {
  const heights = bagHeights(factor);
  const factorText = formatFactor(factor);

  // Shared SVG geometry (viewBox units)
  const panelW = 280;
  const panelH = 220;
  const gap = 24;
  const totalW = panelW * 2 + gap;
  const boxStartY = 52;
  const bagBaseY = 200;

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        <p className="lab-label">Same call sites · different bag</p>
        <p className="lab-mono text-[length:var(--caption)] text-[color:var(--text-secondary)]">
          □ package · ● shipped · ○ shaken · bag = bytes
        </p>
      </figcaption>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${totalW} ${panelH}`}
          role="img"
          aria-label={`Singleton registry ships ${singletonSize}; selective ESM ships ${esmSize}. About ${factorText} larger when loading everything. Illustrated with ${caseTitle}.`}
          className="mx-auto h-auto w-full max-w-2xl"
        >
          {/* Singleton panel */}
          <g>
            <text
              x={0}
              y={16}
              fill="var(--accent)"
              fontSize={11}
              fontFamily="var(--font-mono)"
              letterSpacing="0.08em"
            >
              LOAD EVERYTHING
            </text>
            <text
              x={0}
              y={34}
              fill="var(--text-secondary)"
              fontSize={10}
              fontFamily="var(--font-mono)"
            >
              hub import → all boxes stay live
            </text>

            {/* Hub node */}
            <rect
              x={8}
              y={boxStartY + 6}
              width={28}
              height={24}
              fill="var(--accent)"
              fillOpacity={0.12}
              stroke="var(--accent)"
              strokeWidth={1.5}
            />
            <text
              x={22}
              y={boxStartY + 22}
              textAnchor="middle"
              fill="var(--accent)"
              fontSize={8}
              fontFamily="var(--font-mono)"
              letterSpacing="0.06em"
            >
              HUB
            </text>
            {/* Speaks to every package */}
            {[0, 1, 2].map((i) => (
              <line
                key={i}
                x1={36}
                y1={boxStartY + 18}
                x2={52 + i * 52}
                y2={boxStartY + 18}
                stroke="var(--accent)"
                strokeWidth={1}
                strokeOpacity={0.45}
              />
            ))}
            {PKG_SINGLETON.map((dots, i) => (
              <PackageBox
                key={i}
                dots={dots}
                x={52 + i * 52}
                y={boxStartY}
                stroke="var(--accent)"
                liveFill="var(--accent)"
              />
            ))}

            <BundleBag
              x={72}
              y={bagBaseY - heights.singleton}
              width={120}
              height={heights.singleton}
              fill="var(--accent)"
              strokeWidth={2.5}
            />
            <text
              x={132}
              y={bagBaseY - heights.singleton / 2 + 4}
              textAnchor="middle"
              fill="var(--accent)"
              fontSize={12}
              fontFamily="var(--font-mono)"
              fontWeight={500}
            >
              {singletonSize}
            </text>
          </g>

          {/* ESM panel */}
          <g transform={`translate(${panelW + gap}, 0)`}>
            <text
              x={0}
              y={16}
              fill="var(--success)"
              fontSize={11}
              fontFamily="var(--font-mono)"
              letterSpacing="0.08em"
            >
              ONLY WHAT YOU USE
            </text>
            <text
              x={0}
              y={34}
              fill="var(--text-secondary)"
              fontSize={10}
              fontFamily="var(--font-mono)"
            >
              import call sites → empty dots drop
            </text>

            {PKG_ESM.map((dots, i) => (
              <PackageBox
                key={i}
                dots={dots}
                x={52 + i * 52}
                y={boxStartY}
                stroke="var(--success)"
                liveFill="var(--success)"
              />
            ))}

            <BundleBag
              x={108}
              y={bagBaseY - heights.esm}
              width={48}
              height={heights.esm}
              fill="var(--success)"
              strokeWidth={1.25}
            />
            <text
              x={132}
              y={bagBaseY - heights.esm - 8}
              textAnchor="middle"
              fill="var(--success)"
              fontSize={12}
              fontFamily="var(--font-mono)"
              fontWeight={500}
            >
              {esmSize}
            </text>
          </g>
        </svg>
      </div>

      <p className="text-[length:var(--caption)] leading-relaxed text-[color:var(--text-secondary)]">
        Illustrated from{" "}
        <span className="text-[color:var(--text-primary)]">{caseTitle}</span>
        : same resolvers bound on both arms — singleton bag is{" "}
        <span className="lab-mono text-[color:var(--accent)]">{factorText}</span>{" "}
        the ESM bag. Real KB below.
      </p>
    </figure>
  );
}

type CycleProps = {
  className?: string;
};

/** Mini ring: singleton can light the cycle; ESM only lights imported packages. */
export function CycleRingMetaphor({ className }: CycleProps) {
  const cx = 120;
  const cy = 56;
  const r = 36;
  const n = 4;
  const boxes = Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { x: cx + Math.cos(a) * r - 16, y: cy + Math.sin(a) * r - 12 };
  });

  return (
    <figure className={`flex flex-col gap-2 ${className ?? ""}`}>
      <p className="lab-label">Cycles hold hands</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <svg
            viewBox="0 0 240 120"
            role="img"
            aria-label="Four packages in a ring, all lit by a singleton hub import"
            className="h-auto w-full max-w-xs"
          >
            <text
              x={0}
              y={14}
              fill="var(--accent)"
              fontSize={10}
              fontFamily="var(--font-mono)"
              letterSpacing="0.08em"
            >
              SINGLETON LIGHTS THE RING
            </text>
            {boxes.map((b, i) => {
              const next = boxes[(i + 1) % n]!;
              return (
                <line
                  key={`l-${i}`}
                  x1={b.x + 16}
                  y1={b.y + 12}
                  x2={next.x + 16}
                  y2={next.y + 12}
                  stroke="var(--accent)"
                  strokeWidth={1.25}
                  strokeOpacity={0.5}
                />
              );
            })}
            {boxes.map((b, i) => (
              <g key={i}>
                <rect
                  x={b.x}
                  y={b.y}
                  width={32}
                  height={24}
                  fill="transparent"
                  stroke="var(--accent)"
                  strokeWidth={1.25}
                />
                <circle cx={b.x + 10} cy={b.y + 12} r={2.4} fill="var(--accent)" />
                <circle cx={b.x + 16} cy={b.y + 12} r={2.4} fill="var(--accent)" />
                <circle cx={b.x + 22} cy={b.y + 12} r={2.4} fill="var(--accent)" />
              </g>
            ))}
          </svg>
          <p className="text-[length:var(--caption)] text-[color:var(--text-secondary)]">
            One hub import can drag neighbors you never call.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <svg
            viewBox="0 0 240 120"
            role="img"
            aria-label="Four packages in a ring; only two imported packages stay lit under ESM"
            className="h-auto w-full max-w-xs"
          >
            <text
              x={0}
              y={14}
              fill="var(--success)"
              fontSize={10}
              fontFamily="var(--font-mono)"
              letterSpacing="0.08em"
            >
              ESM LIGHTS WHAT YOU IMPORT
            </text>
            {boxes.map((b, i) => {
              const next = boxes[(i + 1) % n]!;
              return (
                <line
                  key={`l-${i}`}
                  x1={b.x + 16}
                  y1={b.y + 12}
                  x2={next.x + 16}
                  y2={next.y + 12}
                  stroke="var(--border-visible)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              );
            })}
            {boxes.map((b, i) => {
              const lit = i === 0 || i === 1;
              const stroke = lit ? "var(--success)" : "var(--text-disabled)";
              const fill = lit ? "var(--success)" : "transparent";
              return (
                <g key={i} opacity={lit ? 1 : 0.45}>
                  <rect
                    x={b.x}
                    y={b.y}
                    width={32}
                    height={24}
                    fill="transparent"
                    stroke={stroke}
                    strokeWidth={1.25}
                  />
                  <circle
                    cx={b.x + 10}
                    cy={b.y + 12}
                    r={2.4}
                    fill={fill}
                    stroke={lit ? undefined : "var(--text-disabled)"}
                    strokeWidth={lit ? 0 : 1}
                  />
                  <circle
                    cx={b.x + 16}
                    cy={b.y + 12}
                    r={2.4}
                    fill={lit ? "var(--success)" : "transparent"}
                    stroke={lit ? undefined : "var(--text-disabled)"}
                    strokeWidth={lit ? 0 : 1}
                  />
                  <circle
                    cx={b.x + 22}
                    cy={b.y + 12}
                    r={2.4}
                    fill="transparent"
                    stroke="var(--text-disabled)"
                    strokeWidth={1}
                  />
                </g>
              );
            })}
          </svg>
          <p className="text-[length:var(--caption)] text-[color:var(--text-secondary)]">
            Ring edges exist; unused packages stay dark.
          </p>
        </div>
      </div>
    </figure>
  );
}
