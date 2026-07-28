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
  const esmW = 88;
  const esmH = 56;
  const scale = Math.sqrt(Math.max(factor, 1));
  const singletonW = Math.min(168, Math.max(esmW * 1.7, esmW * scale * 0.75));
  const singletonH = Math.min(120, Math.max(esmH * 1.5, esmH * scale * 0.75));
  return { singletonW, singletonH, esmW, esmH };
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
  const boxW = 72;
  const boxH = 38;
  const cols = 5;
  const r = 2.4;
  const gap = 10.5;
  const startX = x + 12;
  const startY = y + 22;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={boxW}
        height={boxH}
        rx={12}
        fill="var(--surface)"
        stroke={stroke}
        strokeWidth={1.5}
      />
      <text
        x={x + boxW / 2}
        y={y + 12}
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
        x={x + 10}
        y={y + 16}
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
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={stroke}
      strokeWidth={1.25}
      strokeOpacity={dashed ? 0.7 : 0.5}
      strokeDasharray={dashed ? "5 4" : undefined}
      markerEnd={dashed ? "url(#arrow-dash)" : "url(#arrow-solid)"}
    />
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
  const bags = bagSize(factor);
  const factorText = formatFactor(factor);

  // Wide LR canvas: APP | arms (stacked)
  const W = 920;
  const H = 460;

  // ── APP (left) ──
  const appX = 12;
  const appY = 150;
  const appW = 168;
  const appH = 160;
  const schemaX = appX + 16;
  const schemaY = appY + 48;
  const schemaW = appW - 32;
  const schemaH = 72;
  const schemaCx = schemaX + schemaW / 2;
  const schemaCy = schemaY + schemaH / 2;

  // ── Arms (right, stacked) ──
  const armX = 240;
  const armW = 668;
  const singletonY = 12;
  const singletonH = 210;
  const esmY = 238;
  const esmH = 210;

  // Column x positions inside each arm (entry → pkgs → bag)
  const entryX = armX + 24;
  const pkgColX = armX + 200;
  const bagColX = armX + 420;

  // Singleton vertical layout for pkgs
  const sPkgYs = [singletonY + 48, singletonY + 96, singletonY + 144];
  const sEntryCx = entryX + 70;
  const sEntryCy = singletonY + singletonH / 2 + 4;
  const sBagX = bagColX;
  const sBagY =
    singletonY + (singletonH - bags.singletonH) / 2 + 8;
  const sBagCx = sBagX + bags.singletonW / 2;
  const sBagCy = sBagY + bags.singletonH / 2;

  // ESM vertical layout
  const ePkgYs = [esmY + 48, esmY + 96, esmY + 144];
  const eImportXs = entryX;
  const eImportW = 118;
  const eBagX = bagColX;
  const eBagY = esmY + (esmH - bags.esmH) / 2 + 8;
  const eBagCx = eBagX + bags.esmW / 2;
  const eBagCy = eBagY + bags.esmH / 2;

  const importLabels = ["import used()", "import used()", "…K call sites"];
  const pkgLabelsS = ["pkg 1", "pkg 2", "pkg N"];
  const pkgLabelsE = ["pkg 1", "pkg 2", "pkg …"];

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
          className="mx-auto h-auto w-full min-w-[640px] max-w-5xl"
        >
          <defs>
            <marker
              id="arrow-solid"
              viewBox="0 0 10 10"
              refX={9}
              refY={5}
              markerWidth={6}
              markerHeight={6}
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-disabled)" />
            </marker>
            <marker
              id="arrow-dash"
              viewBox="0 0 10 10"
              refX={9}
              refY={5}
              markerWidth={6}
              markerHeight={6}
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-secondary)" />
            </marker>
          </defs>

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
            y={schemaY + 28}
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
            y={schemaY + 48}
            textAnchor="middle"
            fill="var(--text-secondary)"
            fontSize={9}
            fontFamily="var(--font-sans)"
          >
            ~2–5 resolvers / package
          </text>

          {/* Dashed edges: Schema → each arm */}
          <Arrow
            x1={appX + appW}
            y1={schemaCy - 24}
            x2={armX}
            y2={sEntryCy}
            stroke="var(--accent)"
            dashed
          />
          <text
            x={(appX + appW + armX) / 2}
            y={sEntryCy - 28}
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
            x2={armX}
            y2={esmY + esmH / 2 + 4}
            stroke="var(--success)"
            dashed
          />
          <text
            x={(appX + appW + armX) / 2}
            y={esmY + esmH / 2 + 36}
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
            cy={sEntryCy - 22}
            rx={68}
            ry={10}
            fill="var(--accent)"
            fillOpacity={0.1}
            stroke="var(--accent)"
            strokeWidth={1.5}
          />
          <rect
            x={sEntryCx - 68}
            y={sEntryCy - 22}
            width={136}
            height={44}
            fill="var(--accent)"
            fillOpacity={0.1}
            stroke="none"
          />
          <line
            x1={sEntryCx - 68}
            y1={sEntryCy - 22}
            x2={sEntryCx - 68}
            y2={sEntryCy + 22}
            stroke="var(--accent)"
            strokeWidth={1.5}
          />
          <line
            x1={sEntryCx + 68}
            y1={sEntryCy - 22}
            x2={sEntryCx + 68}
            y2={sEntryCy + 22}
            stroke="var(--accent)"
            strokeWidth={1.5}
          />
          <ellipse
            cx={sEntryCx}
            cy={sEntryCy + 22}
            rx={68}
            ry={10}
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
            y={sEntryCy + 14}
            textAnchor="middle"
            fill="var(--accent)"
            fontSize={8}
            fontFamily="var(--font-sans)"
            opacity={0.85}
          >
            side-effect import
          </text>

          {/* Registry → pkgs */}
          {sPkgYs.map((py, i) => (
            <Arrow
              key={`s-in-${i}`}
              x1={sEntryCx + 68}
              y1={sEntryCy}
              x2={pkgColX}
              y2={py + 19}
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

          {/* pkgs → bag */}
          {sPkgYs.map((py, i) => (
            <Arrow
              key={`s-out-${i}`}
              x1={pkgColX + 72}
              y1={py + 19}
              x2={sBagX}
              y2={sBagCy}
              stroke="var(--accent)"
            />
          ))}

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
            y={sBagCy - 10}
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
            y={sBagCy + 26}
            textAnchor="middle"
            fill="var(--accent)"
            fontSize={8}
            fontFamily="var(--font-mono)"
            opacity={0.8}
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
                width={eImportW}
                height={38}
                rx={12}
                fill="var(--success)"
                fillOpacity={0.1}
                stroke="var(--success)"
                strokeWidth={1.5}
              />
              <text
                x={eImportXs + eImportW / 2}
                y={py + 23}
                textAnchor="middle"
                fill="var(--success)"
                fontSize={9}
                fontFamily="var(--font-mono)"
                letterSpacing="0.03em"
              >
                {importLabels[i]}
              </text>

              <Arrow
                x1={eImportXs + eImportW}
                y1={py + 19}
                x2={pkgColX}
                y2={py + 19}
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

              <Arrow
                x1={pkgColX + 72}
                y1={py + 19}
                x2={eBagX}
                y2={eBagCy}
                stroke="var(--success)"
              />
            </g>
          ))}

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
            y={eBagCy - 6}
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
            y={eBagCy + 12}
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
            fill="var(--success)"
            fontSize={8}
            fontFamily="var(--font-mono)"
            opacity={0.85}
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
