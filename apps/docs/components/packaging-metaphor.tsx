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

/** Three packages — singleton keeps every export live. */
const PKG_SINGLETON: Dot[][] = [
  ["live", "live", "live", "live", "live"],
  ["live", "live", "live", "live", "live"],
  ["live", "live", "live", "live", "live"],
];

/** Same K call sites; only used exports stay lit. */
const PKG_ESM: Dot[][] = [
  ["live", "out", "out", "out", "out"],
  ["live", "out", "out", "out", "out"],
  ["live", "out", "out", "out", "out"],
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
  const esmW = 52;
  const esmH = 40;
  const scale = Math.sqrt(Math.max(factor, 1));
  const singletonW = Math.min(140, Math.max(esmW * 1.8, esmW * scale * 0.85));
  const singletonH = Math.min(100, Math.max(esmH * 1.6, esmH * scale * 0.85));
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
  label,
}: {
  dots: Dot[];
  x: number;
  y: number;
  stroke: string;
  liveFill: string;
  label: string;
}) {
  const boxW = 64;
  const boxH = 36;
  const cols = 5;
  const r = 2.6;
  const gap = 9.5;
  const startX = x + 10;
  const startY = y + 20;

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
      <text
        x={x + 4}
        y={y + 12}
        fill={stroke}
        fontSize={8}
        fontFamily="var(--font-mono)"
        letterSpacing="0.04em"
      >
        {label}
      </text>
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
            strokeWidth={1.1}
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
  const mouth = Math.min(16, width * 0.18);
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
      fillOpacity={0.14}
      stroke={fill}
      strokeWidth={strokeWidth}
    />
  );
}

function ArmFrame({
  x,
  y,
  width,
  height,
  stroke,
  title,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
  title: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={2}
        fill="transparent"
        stroke={stroke}
        strokeWidth={1}
        strokeOpacity={0.35}
      />
      <text
        x={x + 10}
        y={y + 16}
        fill={stroke}
        fontSize={10}
        fontFamily="var(--font-mono)"
        letterSpacing="0.08em"
      >
        {title}
      </text>
    </g>
  );
}

/**
 * Flowchart teaching diagram (mermaid LR → top-split layout):
 * App/schema at top → dashed edges to Singleton arm (huge bag)
 * and ESM arm (thin bag). Same K call sites both sides.
 */
export function PackagingMetaphor({
  singletonSize,
  esmSize,
  factor,
  caseTitle,
}: Props) {
  const bags = bagSize(factor);
  const factorText = formatFactor(factor);

  const W = 640;
  const H = 420;

  // App / schema (top center)
  const appX = 200;
  const appY = 8;
  const appW = 240;
  const appH = 52;
  const schemaCx = appX + appW / 2;
  const schemaCy = appY + appH;

  // Arms
  const armY = 100;
  const armH = 300;
  const armW = 290;
  const leftX = 16;
  const rightX = 334;

  // Package rows
  const pkgY = armY + 78;
  const leftPkgsX = [leftX + 18, leftX + 112, leftX + 206];
  const rightPkgsX = [rightX + 18, rightX + 112, rightX + 206];

  // Bags sit under packages
  const bagFloor = armY + armH - 16;
  const leftBagX = leftX + (armW - bags.singletonW) / 2;
  const rightBagX = rightX + (armW - bags.esmW) / 2;
  const leftBagY = bagFloor - bags.singletonH;
  const rightBagY = bagFloor - bags.esmH;

  // Registry / import entry nodes
  const entryY = armY + 28;
  const leftEntryCx = leftX + armW / 2;
  const rightEntryCx = rightX + armW / 2;

  return (
    <figure className="lab-metaphor flex flex-col gap-3">
      <figcaption className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        <p className="lab-label">□ pkg · ● shipped · ○ shaken · bag = bytes</p>
        <p className="lab-mono text-[length:var(--caption)] text-[color:var(--text-secondary)]">
          {caseTitle} · {factorText}
        </p>
      </figcaption>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Flowchart: schema binds call sites. Singleton arm ships ${singletonSize}; ESM arm ships ${esmSize} — about ${factorText} smaller.`}
          className="mx-auto h-auto w-full max-w-3xl"
        >
          {/* ── Your GraphQL app ── */}
          <rect
            x={appX}
            y={appY}
            width={appW}
            height={appH}
            rx={2}
            fill="var(--surface-raised)"
            stroke="var(--border-visible)"
            strokeWidth={1.5}
          />
          <text
            x={schemaCx}
            y={appY + 20}
            textAnchor="middle"
            fill="var(--text-primary)"
            fontSize={12}
            fontFamily="var(--font-mono)"
            letterSpacing="0.06em"
          >
            YOUR GRAPHQL APP
          </text>
          <text
            x={schemaCx}
            y={appY + 38}
            textAnchor="middle"
            fill="var(--text-secondary)"
            fontSize={11}
            fontFamily="var(--font-sans)"
          >
            Schema binds · ~2–5 resolvers / pkg
          </text>

          {/* Dashed edges: same K call sites */}
          <path
            d={`M ${schemaCx - 20} ${schemaCy} C ${schemaCx - 80} ${schemaCy + 28}, ${leftEntryCx} ${armY - 10}, ${leftEntryCx} ${armY}`}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1.25}
            strokeDasharray="4 4"
            strokeOpacity={0.7}
          />
          <path
            d={`M ${schemaCx + 20} ${schemaCy} C ${schemaCx + 80} ${schemaCy + 28}, ${rightEntryCx} ${armY - 10}, ${rightEntryCx} ${armY}`}
            fill="none"
            stroke="var(--success)"
            strokeWidth={1.25}
            strokeDasharray="4 4"
            strokeOpacity={0.7}
          />
          <text
            x={schemaCx - 100}
            y={schemaCy + 28}
            fill="var(--accent)"
            fontSize={9}
            fontFamily="var(--font-mono)"
            letterSpacing="0.04em"
          >
            calls K sites
          </text>
          <text
            x={schemaCx + 48}
            y={schemaCy + 28}
            fill="var(--success)"
            fontSize={9}
            fontFamily="var(--font-mono)"
            letterSpacing="0.04em"
          >
            imports K sites
          </text>

          {/* ── Singleton arm ── */}
          <ArmFrame
            x={leftX}
            y={armY}
            width={armW}
            height={armH}
            stroke="var(--accent)"
            title="SINGLETON ARM — ONE BIG BAG"
          />

          {/* Registry node */}
          <ellipse
            cx={leftEntryCx}
            cy={entryY + 14}
            rx={72}
            ry={18}
            fill="var(--accent)"
            fillOpacity={0.12}
            stroke="var(--accent)"
            strokeWidth={1.5}
          />
          <text
            x={leftEntryCx}
            y={entryY + 11}
            textAnchor="middle"
            fill="var(--accent)"
            fontSize={10}
            fontFamily="var(--font-mono)"
            letterSpacing="0.06em"
          >
            REGISTRY
          </text>
          <text
            x={leftEntryCx}
            y={entryY + 23}
            textAnchor="middle"
            fill="var(--accent)"
            fontSize={8}
            fontFamily="var(--font-sans)"
            opacity={0.85}
          >
            side-effect import
          </text>

          {leftPkgsX.map((x, i) => (
            <line
              key={`s-spoke-${i}`}
              x1={leftEntryCx}
              y1={entryY + 32}
              x2={x + 32}
              y2={pkgY}
              stroke="var(--accent)"
              strokeWidth={1.15}
              strokeOpacity={0.45}
            />
          ))}

          {PKG_SINGLETON.map((dots, i) => (
            <PackageBox
              key={`s-${i}`}
              dots={dots}
              x={leftPkgsX[i]!}
              y={pkgY}
              stroke="var(--accent)"
              liveFill="var(--accent)"
              label={i === 2 ? "pkg N" : `pkg ${i + 1}`}
            />
          ))}

          {leftPkgsX.map((x, i) => (
            <line
              key={`s-funnel-${i}`}
              x1={x + 32}
              y1={pkgY + 36}
              x2={leftBagX + bags.singletonW / 2}
              y2={leftBagY}
              stroke="var(--accent)"
              strokeWidth={1}
              strokeOpacity={0.35}
            />
          ))}

          <BundleBag
            x={leftBagX}
            y={leftBagY}
            width={bags.singletonW}
            height={bags.singletonH}
            fill="var(--accent)"
            strokeWidth={2.25}
          />
          <text
            x={leftX + armW / 2}
            y={leftBagY + bags.singletonH / 2 - 4}
            textAnchor="middle"
            fill="var(--accent)"
            fontSize={13}
            fontFamily="var(--font-mono)"
            fontWeight={500}
          >
            {singletonSize}
          </text>
          <text
            x={leftX + armW / 2}
            y={leftBagY + bags.singletonH / 2 + 12}
            textAnchor="middle"
            fill="var(--accent)"
            fontSize={8}
            fontFamily="var(--font-mono)"
            letterSpacing="0.04em"
            opacity={0.8}
          >
            ALL DOTS
          </text>

          {/* ── ESM arm ── */}
          <ArmFrame
            x={rightX}
            y={armY}
            width={armW}
            height={armH}
            stroke="var(--success)"
            title="ESM ARM — THIN BAG"
          />

          {/* Import call-sites node */}
          <rect
            x={rightEntryCx - 78}
            y={entryY}
            width={156}
            height={28}
            rx={1}
            fill="var(--success)"
            fillOpacity={0.1}
            stroke="var(--success)"
            strokeWidth={1.5}
          />
          <text
            x={rightEntryCx}
            y={entryY + 12}
            textAnchor="middle"
            fill="var(--success)"
            fontSize={10}
            fontFamily="var(--font-mono)"
            letterSpacing="0.04em"
          >
            import used()
          </text>
          <text
            x={rightEntryCx}
            y={entryY + 23}
            textAnchor="middle"
            fill="var(--success)"
            fontSize={8}
            fontFamily="var(--font-sans)"
            opacity={0.85}
          >
            …K call sites
          </text>

          {rightPkgsX.map((x, i) => (
            <line
              key={`e-spoke-${i}`}
              x1={rightEntryCx}
              y1={entryY + 28}
              x2={x + 32}
              y2={pkgY}
              stroke="var(--success)"
              strokeWidth={1.15}
              strokeOpacity={0.45}
            />
          ))}

          {PKG_ESM.map((dots, i) => (
            <PackageBox
              key={`e-${i}`}
              dots={dots}
              x={rightPkgsX[i]!}
              y={pkgY}
              stroke="var(--success)"
              liveFill="var(--success)"
              label={i === 2 ? "pkg …" : `pkg ${i + 1}`}
            />
          ))}

          {rightPkgsX.map((x, i) => (
            <line
              key={`e-funnel-${i}`}
              x1={x + 32}
              y1={pkgY + 36}
              x2={rightBagX + bags.esmW / 2}
              y2={rightBagY}
              stroke="var(--success)"
              strokeWidth={1}
              strokeOpacity={0.35}
            />
          ))}

          <BundleBag
            x={rightBagX}
            y={rightBagY}
            width={bags.esmW}
            height={bags.esmH}
            fill="var(--success)"
            strokeWidth={1.5}
          />
          <text
            x={rightX + armW / 2}
            y={rightBagY - 8}
            textAnchor="middle"
            fill="var(--success)"
            fontSize={13}
            fontFamily="var(--font-mono)"
            fontWeight={500}
          >
            {esmSize}
          </text>
          <text
            x={rightX + armW / 2}
            y={rightBagY + bags.esmH / 2 + 4}
            textAnchor="middle"
            fill="var(--success)"
            fontSize={8}
            fontFamily="var(--font-mono)"
            letterSpacing="0.04em"
            opacity={0.85}
          >
            FILLED ONLY
          </text>
        </svg>
      </div>

      <p className="lab-mono text-[length:var(--caption)] text-[color:var(--text-secondary)]">
        Cycles: a hub can light neighbors you never call — ESM only lights
        imports.{" "}
        <a
          href="/docs/why"
          className="text-[color:var(--text-primary)] underline-offset-2 hover:underline"
        >
          Why →
        </a>
      </p>
    </figure>
  );
}
