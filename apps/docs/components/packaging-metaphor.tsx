type Props = {
  /** e.g. "4.2 MB" — singleton bag label */
  singletonSize: string;
  /** e.g. "448.7 KB" — ESM bag label */
  esmSize: string;
  /** Size factor, e.g. 9.3 — drives honest bag area */
  factor: number;
  /** Short case name for the caption, e.g. "Wide module surface" */
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

const PKG_BOX_W = 76;
const PKG_BOX_H = 40;
/** Gap so arrowheads clear node strokes / text. */
const ARROW_GAP = 10;
const BAG_PAD_X = 22;
const BAG_PAD_Y = 18;

/**
 * Conservative monospace advance (JetBrains / IBM Plex Mono ≈ 0.6em).
 * Slightly overestimates so boxes never clip.
 */
function estimateMonoWidth(
  text: string,
  fontSize: number,
  letterSpacingEm = 0,
): number {
  const advance = 0.62;
  const letters = Math.max(text.length - 1, 0);
  return text.length * fontSize * advance + letters * letterSpacingEm * fontSize;
}

/**
 * Area-honest bags sized from label text first, then √factor scale.
 * ESM is the content-fit base; singleton grows with √factor (area ∝ factor).
 */
function bagSize(
  factor: number,
  singletonSize: string,
  esmSize: string,
): {
  singletonW: number;
  singletonH: number;
  esmW: number;
  esmH: number;
} {
  const esmTitle = "BAG = filled dots only";
  const sTitle = "BAG = ALL dots";

  const esmContentW = Math.max(
    estimateMonoWidth(esmTitle, 9, 0.03),
    estimateMonoWidth(esmSize, 13),
    estimateMonoWidth("tiny", 9),
  );
  const sContentW = Math.max(
    estimateMonoWidth(sTitle, 11, 0.04),
    estimateMonoWidth(singletonSize, 14),
    estimateMonoWidth("huge", 9),
  );

  // Title + size + tag baselines with breathing room
  const esmContentH = 9 + 10 + 13 + 10 + 9;
  const sContentH = 11 + 10 + 14 + 10 + 9;

  const esmW = Math.ceil(esmContentW + BAG_PAD_X * 2);
  const esmH = Math.ceil(esmContentH + BAG_PAD_Y * 2);

  const scale = Math.sqrt(Math.max(factor, 1));
  // Grow from content floor; keep area-ish honesty without crushing labels
  const singletonW = Math.min(
    220,
    Math.max(sContentW + BAG_PAD_X * 2, esmW * 1.35, esmW * scale * 0.7),
  );
  const singletonH = Math.min(
    150,
    Math.max(sContentH + BAG_PAD_Y * 2, esmH * 1.25, esmH * scale * 0.7),
  );

  return {
    singletonW: Math.ceil(singletonW),
    singletonH: Math.ceil(singletonH),
    esmW,
    esmH,
  };
}

function formatFactor(factor: number): string {
  if (factor >= 100) return `${Math.round(factor)}×`;
  if (factor >= 10) return `${factor.toFixed(0)}×`;
  return `${factor.toFixed(1)}×`;
}

/** Mermaid-style stadium / rounded-rect package with dots. */
function PackageNode({
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
  const cols = 5;
  const r = 2.4;
  const gap = 11;
  const startX = x + 14;
  const startY = y + 24;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={PKG_BOX_W}
        height={PKG_BOX_H}
        rx={12}
        fill="var(--surface)"
        stroke={stroke}
        strokeWidth={1.5}
      />
      <text
        x={x + PKG_BOX_W / 2}
        y={y + 13}
        textAnchor="middle"
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

function SubgraphFrame({
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
        rx={4}
        fill="transparent"
        stroke={stroke}
        strokeWidth={1}
        strokeOpacity={0.4}
      />
      <text
        x={x + 12}
        y={y + 18}
        fill={stroke}
        fontSize={9}
        fontFamily="var(--font-mono)"
        letterSpacing="0.06em"
      >
        {title}
      </text>
    </g>
  );
}

/** Inline chevron so color always matches stroke (no grey/default marker). */
function ArrowHead({
  x,
  y,
  angle,
  fill,
  size = 7,
}: {
  x: number;
  y: number;
  angle: number;
  fill: string;
  size?: number;
}) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const back = size;
  const half = size * 0.55;
  const bx = x - cos * back;
  const by = y - sin * back;
  const p1x = bx + -sin * half;
  const p1y = by + cos * half;
  const p2x = bx - -sin * half;
  const p2y = by - cos * half;
  return (
    <path
      d={`M ${x} ${y} L ${p1x} ${p1y} L ${p2x} ${p2y} Z`}
      fill={fill}
      stroke="none"
    />
  );
}

function Arrow({
  x1,
  y1,
  x2,
  y2,
  stroke,
  dashed = false,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  dashed?: boolean;
}) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  // Shorten the shaft so the tip sits on (x2,y2), not under the head
  const tipBack = 1;
  const shaftX2 = x2 - Math.cos(angle) * tipBack;
  const shaftY2 = y2 - Math.sin(angle) * tipBack;

  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={shaftX2}
        y2={shaftY2}
        stroke={stroke}
        strokeWidth={1.25}
        strokeOpacity={dashed ? 0.7 : 0.55}
        strokeDasharray={dashed ? "5 4" : undefined}
      />
      <ArrowHead x={x2} y={y2} angle={angle} fill={stroke} />
    </g>
  );
}

/**
 * Mermaid-style fan-in: shafts meet at a junction, then ONE colored arrow
 * into the bag. Avoids stacked marker diamonds at the merge point.
 */
function FanInArrow({
  sources,
  targetX,
  targetY,
  stroke,
}: {
  sources: ReadonlyArray<{ x: number; y: number }>;
  targetX: number;
  targetY: number;
  stroke: string;
}) {
  const joinX = targetX - 22;
  const joinY = targetY;
  const angle = 0; // LR into bag

  return (
    <g>
      {sources.map((s, i) => (
        <line
          key={i}
          x1={s.x}
          y1={s.y}
          x2={joinX}
          y2={joinY}
          stroke={stroke}
          strokeWidth={1.25}
          strokeOpacity={0.5}
        />
      ))}
      <circle cx={joinX} cy={joinY} r={2.75} fill={stroke} opacity={0.9} />
      <line
        x1={joinX}
        y1={joinY}
        x2={targetX - 1}
        y2={targetY}
        stroke={stroke}
        strokeWidth={1.35}
        strokeOpacity={0.65}
      />
      <ArrowHead x={targetX} y={targetY} angle={angle} fill={stroke} size={8} />
    </g>
  );
}

/**
 * Literal mermaid `flowchart LR` topology:
 *   APP (left)  -.->  SINGLETON arm (right-top):  Registry → pkgs → huge BAG
 *               -.->  ESM arm (right-bottom):     import used() → pkgs → thin BAG
 * Each arm reads left → right. Arms stack vertically on the right.
 */
export function PackagingMetaphor({
  singletonSize,
  esmSize,
  factor,
  caseTitle,
}: Props) {
  const bags = bagSize(factor, singletonSize, esmSize);
  const factorText = formatFactor(factor);

  // Column geometry (entry → pkgs → bag), sized from widest bag
  const bagColW = Math.max(bags.singletonW, bags.esmW);
  const entryW = 140;
  const importW = 128;
  const colGap = 56;
  const armPadX = 28;
  const armInnerW =
    armPadX * 2 +
    Math.max(entryW, importW) +
    colGap +
    PKG_BOX_W +
    colGap +
    bagColW;

  const appW = 188;
  const bridgeGap = 72;
  const armX = 16 + appW + bridgeGap;
  const armW = armInnerW;
  const W = armX + armW + 16;

  const singletonH = Math.max(220, bags.singletonH + 56);
  const esmH = Math.max(220, bags.esmH + 56);
  const armGap = 24;
  const singletonY = 12;
  const esmY = singletonY + singletonH + armGap;
  const H = esmY + esmH + 12;

  // ── APP (left) ──
  const appX = 12;
  const appY = Math.max(singletonY + 40, (H - 172) / 2);
  const appH = 172;
  const schemaX = appX + 16;
  const schemaY = appY + 52;
  const schemaW = appW - 32;
  const schemaH = 80;
  const schemaCx = schemaX + schemaW / 2;
  const schemaCy = schemaY + schemaH / 2;

  // Column x positions inside each arm
  const entryX = armX + armPadX;
  const pkgColX = entryX + Math.max(entryW, importW) + colGap;
  const bagColX = pkgColX + PKG_BOX_W + colGap;

  // Singleton vertical layout for pkgs
  const sPkgYs = [singletonY + 52, singletonY + 104, singletonY + 156];
  const sEntryCx = entryX + entryW / 2;
  const sEntryCy = singletonY + singletonH / 2 + 4;
  const sBagX = bagColX + (bagColW - bags.singletonW) / 2;
  const sBagY = singletonY + (singletonH - bags.singletonH) / 2 + 6;
  const sBagCx = sBagX + bags.singletonW / 2;
  const sBagCy = sBagY + bags.singletonH / 2;

  // ESM vertical layout
  const ePkgYs = [esmY + 52, esmY + 104, esmY + 156];
  const eImportXs = entryX;
  const eBagX = bagColX + (bagColW - bags.esmW) / 2;
  const eBagY = esmY + (esmH - bags.esmH) / 2 + 6;
  const eBagCx = eBagX + bags.esmW / 2;
  const eBagCy = eBagY + bags.esmH / 2;

  const importLabels = ["import used()", "import used()", "…K call sites"];
  const pkgLabelsS = ["pkg 1", "pkg 2", "pkg N"];
  const pkgLabelsE = ["pkg 1", "pkg 2", "pkg …"];

  // Registry cylinder half-width
  const regRx = 70;

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
          aria-label={`Flowchart LR: schema binds call sites. Singleton arm ships ${singletonSize}; ESM arm ships ${esmSize} — about ${factorText} smaller.`}
          className="mx-auto h-auto w-full min-w-[720px] max-w-6xl"
        >
          {/* ── APP subgraph (left) ── */}
          <SubgraphFrame
            x={appX}
            y={appY}
            width={appW}
            height={appH}
            stroke="var(--text-secondary)"
            title="YOUR GRAPHQL APP"
          />
          <rect
            x={schemaX}
            y={schemaY}
            width={schemaW}
            height={schemaH}
            rx={4}
            fill="var(--surface-raised)"
            stroke="var(--border-visible)"
            strokeWidth={1.5}
          />
          <text
            x={schemaCx}
            y={schemaY + 30}
            textAnchor="middle"
            fill="var(--text-primary)"
            fontSize={11}
            fontFamily="var(--font-mono)"
            letterSpacing="0.04em"
          >
            Schema binds
          </text>
          <text
            x={schemaCx}
            y={schemaY + 52}
            textAnchor="middle"
            fill="var(--text-secondary)"
            fontSize={10}
            fontFamily="var(--font-sans)"
          >
            ~2–5 resolvers / package
          </text>

          {/* Dashed edges: Schema → each arm */}
          <Arrow
            x1={appX + appW}
            y1={schemaCy - 24}
            x2={armX - ARROW_GAP}
            y2={sEntryCy}
            stroke="var(--accent)"
            dashed
          />
          <text
            x={(appX + appW + armX) / 2}
            y={sEntryCy - 32}
            textAnchor="middle"
            fill="var(--accent)"
            fontSize={9}
            fontFamily="var(--font-mono)"
            letterSpacing="0.04em"
          >
            calls K sites
          </text>

          <Arrow
            x1={appX + appW}
            y1={schemaCy + 24}
            x2={armX - ARROW_GAP}
            y2={esmY + esmH / 2 + 4}
            stroke="var(--success)"
            dashed
          />
          <text
            x={(appX + appW + armX) / 2}
            y={esmY + esmH / 2 + 40}
            textAnchor="middle"
            fill="var(--success)"
            fontSize={9}
            fontFamily="var(--font-mono)"
            letterSpacing="0.04em"
          >
            imports K sites
          </text>

          {/* ── SINGLETON arm (right-top): Registry → pkgs → BAG ── */}
          <SubgraphFrame
            x={armX}
            y={singletonY}
            width={armW}
            height={singletonH}
            stroke="var(--accent)"
            title="SINGLETON ARM — ONE BIG BAG"
          />

          {/* Registry cylinder */}
          <ellipse
            cx={sEntryCx}
            cy={sEntryCy - 24}
            rx={regRx}
            ry={11}
            fill="var(--accent)"
            fillOpacity={0.1}
            stroke="var(--accent)"
            strokeWidth={1.5}
          />
          <rect
            x={sEntryCx - regRx}
            y={sEntryCy - 24}
            width={regRx * 2}
            height={48}
            fill="var(--accent)"
            fillOpacity={0.1}
            stroke="none"
          />
          <line
            x1={sEntryCx - regRx}
            y1={sEntryCy - 24}
            x2={sEntryCx - regRx}
            y2={sEntryCy + 24}
            stroke="var(--accent)"
            strokeWidth={1.5}
          />
          <line
            x1={sEntryCx + regRx}
            y1={sEntryCy - 24}
            x2={sEntryCx + regRx}
            y2={sEntryCy + 24}
            stroke="var(--accent)"
            strokeWidth={1.5}
          />
          <ellipse
            cx={sEntryCx}
            cy={sEntryCy + 24}
            rx={regRx}
            ry={11}
            fill="var(--accent)"
            fillOpacity={0.14}
            stroke="var(--accent)"
            strokeWidth={1.5}
          />
          <text
            x={sEntryCx}
            y={sEntryCy - 2}
            textAnchor="middle"
            fill="var(--accent)"
            fontSize={11}
            fontFamily="var(--font-mono)"
            letterSpacing="0.05em"
          >
            Registry
          </text>
          <text
            x={sEntryCx}
            y={sEntryCy + 15}
            textAnchor="middle"
            fill="var(--text-secondary)"
            fontSize={10}
            fontFamily="var(--font-sans)"
          >
            side-effect import
          </text>

          {/* Registry → pkgs */}
          {sPkgYs.map((py, i) => (
            <Arrow
              key={`s-in-${i}`}
              x1={sEntryCx + regRx}
              y1={sEntryCy}
              x2={pkgColX - ARROW_GAP}
              y2={py + PKG_BOX_H / 2}
              stroke="var(--accent)"
            />
          ))}

          {PKG_SINGLETON.map((dots, i) => (
            <PackageNode
              key={`s-${i}`}
              dots={dots}
              x={pkgColX}
              y={sPkgYs[i]!}
              stroke="var(--accent)"
              liveFill="var(--accent)"
              label={pkgLabelsS[i]!}
            />
          ))}

          {/* pkgs → bag (fan-in: one colored head) */}
          <FanInArrow
            sources={sPkgYs.map((py) => ({
              x: pkgColX + PKG_BOX_W,
              y: py + PKG_BOX_H / 2,
            }))}
            targetX={sBagX - 1}
            targetY={sBagCy}
            stroke="var(--accent)"
          />

          {/* Huge BAG node */}
          <rect
            x={sBagX}
            y={sBagY}
            width={bags.singletonW}
            height={bags.singletonH}
            rx={6}
            fill="var(--accent)"
            fillOpacity={0.12}
            stroke="var(--accent)"
            strokeWidth={2.25}
          />
          <text
            x={sBagCx}
            y={sBagCy - 14}
            textAnchor="middle"
            fill="var(--accent)"
            fontSize={11}
            fontFamily="var(--font-mono)"
            letterSpacing="0.04em"
          >
            BAG = ALL dots
          </text>
          <text
            x={sBagCx}
            y={sBagCy + 8}
            textAnchor="middle"
            fill="var(--accent)"
            fontSize={14}
            fontFamily="var(--font-mono)"
            fontWeight={500}
          >
            {singletonSize}
          </text>
          <text
            x={sBagCx}
            y={sBagCy + 28}
            textAnchor="middle"
            fill="var(--text-secondary)"
            fontSize={9}
            fontFamily="var(--font-mono)"
          >
            huge
          </text>

          {/* ── ESM arm (right-bottom): import used() → pkgs → BAG ── */}
          <SubgraphFrame
            x={armX}
            y={esmY}
            width={armW}
            height={esmH}
            stroke="var(--success)"
            title="ESM ARM — THIN BAG"
          />

          {ePkgYs.map((py, i) => (
            <g key={`e-row-${i}`}>
              <rect
                x={eImportXs}
                y={py}
                width={importW}
                height={PKG_BOX_H}
                rx={12}
                fill="var(--success)"
                fillOpacity={0.1}
                stroke="var(--success)"
                strokeWidth={1.5}
              />
              <text
                x={eImportXs + importW / 2}
                y={py + 25}
                textAnchor="middle"
                fill="var(--text-primary)"
                fontSize={10}
                fontFamily="var(--font-mono)"
                letterSpacing="0.03em"
              >
                {importLabels[i]}
              </text>

              <Arrow
                x1={eImportXs + importW}
                y1={py + PKG_BOX_H / 2}
                x2={pkgColX - ARROW_GAP}
                y2={py + PKG_BOX_H / 2}
                stroke="var(--success)"
              />

              <PackageNode
                dots={PKG_ESM[i]!}
                x={pkgColX}
                y={py}
                stroke="var(--success)"
                liveFill="var(--success)"
                label={pkgLabelsE[i]!}
              />
            </g>
          ))}

          {/* pkgs → bag (fan-in: one colored head) */}
          <FanInArrow
            sources={ePkgYs.map((py) => ({
              x: pkgColX + PKG_BOX_W,
              y: py + PKG_BOX_H / 2,
            }))}
            targetX={eBagX - 1}
            targetY={eBagCy}
            stroke="var(--success)"
          />

          {/* Thin BAG node */}
          <rect
            x={eBagX}
            y={eBagY}
            width={bags.esmW}
            height={bags.esmH}
            rx={6}
            fill="var(--success)"
            fillOpacity={0.12}
            stroke="var(--success)"
            strokeWidth={1.5}
          />
          <text
            x={eBagCx}
            y={eBagCy - 14}
            textAnchor="middle"
            fill="var(--success)"
            fontSize={9}
            fontFamily="var(--font-mono)"
            letterSpacing="0.03em"
          >
            BAG = filled dots only
          </text>
          <text
            x={eBagCx}
            y={eBagCy + 8}
            textAnchor="middle"
            fill="var(--success)"
            fontSize={13}
            fontFamily="var(--font-mono)"
            fontWeight={500}
          >
            {esmSize}
          </text>
          <text
            x={eBagCx}
            y={eBagCy + 28}
            textAnchor="middle"
            fill="var(--text-secondary)"
            fontSize={9}
            fontFamily="var(--font-mono)"
          >
            tiny
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
