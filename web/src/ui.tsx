import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

/** Runs `load` when `deps` change. `load` is a new closure on every render, so it isn't a dependency itself. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): { data: T | null; error: string | null } {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    let live = true;
    load().then(
      (data) => live && setState({ data, error: null }),
      (err) => live && setState({ data: null, error: String(err.message ?? err) }),
    );
    return () => {
      live = false;
    };
  }, deps);
  return state;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h1 className="pixel">{title}</h1>
      {children && <p style={{ margin: "0 auto" }}>{children}</p>}
    </div>
  );
}

export function Tile({ value, label, sub }: { value: ReactNode; label: string; sub?: ReactNode }) {
  return (
    <div className="tile">
      <div className="v">{value}</div>
      <div className="l">{label}</div>
      {sub && <div className="s">{sub}</div>}
    </div>
  );
}

interface Tip {
  x: number;
  y: number;
  text: string;
}

function TipBox({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div className="tip" style={{ left: Math.min(tip.x + 12, window.innerWidth - 300), top: tip.y + 14 }}>
      {tip.text}
    </div>
  );
}

/**
 * The score adjustments that produced a guide's score. Points can go either way,
 * so the bars run from a zero line: gains to the right, penalties to the left.
 */
export function ScoreBreakdown({ base, reasons }: { base: number; reasons: string[] }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const items = reasons
    .map((r) => {
      const m = r.match(/\(([+-]\d+)\)$/);
      return m ? { text: r.replace(/\s*\([+-]\d+\)$/, ""), points: Number(m[1]) } : null;
    })
    .filter((x): x is { text: string; points: number } => x !== null);
  if (!items.length) return null;

  const W = 640;
  const rowH = 30;
  const labelW = 320;
  const span = Math.max(40, ...items.map((i) => Math.abs(i.points)));
  const half = (W - labelW - 36) / 2;
  const zero = labelW + half;
  const x = (p: number) => (p / span) * half;

  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${items.length * rowH + 22}`} width="100%" role="img" aria-label="How the score was reached">
        <line className="grid" x1={zero} x2={zero} y1={0} y2={items.length * rowH} />
        {items.map((it, i) => {
          const y = i * rowH + 7;
          const w = Math.max(2, Math.abs(x(it.points)));
          const neg = it.points < 0;
          const left = neg ? zero - w : zero;
          const r = Math.min(4, w / 2);
          const path = neg
            ? `M${left + w},${y} H${left + r} A${r},${r} 0 0 0 ${left},${y + r} V${y + 14 - r} A${r},${r} 0 0 0 ${left + r},${y + 14} H${left + w} Z`
            : `M${left},${y} H${left + w - r} A${r},${r} 0 0 1 ${left + w},${y + r} V${y + 14 - r} A${r},${r} 0 0 1 ${left + w - r},${y + 14} H${left} Z`;
          return (
            <g key={it.text} onMouseMove={(e: MouseEvent) => setTip({ x: e.clientX, y: e.clientY, text: `${it.text} (${it.points > 0 ? "+" : ""}${it.points})` })} onMouseLeave={() => setTip(null)}>
              <rect x={0} y={i * rowH} width={W} height={rowH} fill="transparent" />
              <text x={labelW - 12} y={y + 11} textAnchor="end">
                {it.text.length > 56 ? it.text.slice(0, 55) + "…" : it.text}
              </text>
              <path d={path} fill={neg ? "var(--penalty)" : "var(--gain)"} />
              <text x={neg ? left - 6 : left + w + 6} y={y + 11} textAnchor={neg ? "end" : "start"} style={{ fill: "var(--ink)" }}>
                {it.points > 0 ? "+" : ""}
                {it.points}
              </text>
            </g>
          );
        })}
        <text x={zero} y={items.length * rowH + 16} textAnchor="middle">
          starts at {base}
        </text>
      </svg>
      <TipBox tip={tip} />
    </>
  );
}

/** Off-target matches by how many bases differ. One ordered measure, so one hue, light to dark. */
export function MismatchBars({ counts }: { counts: number[] }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const W = 320;
  const rowH = 26;
  const labelW = 110;
  const max = Math.max(1, ...counts);
  const steps = ["var(--seq-5)", "var(--seq-4)", "var(--seq-3)", "var(--seq-2)"];
  const labels = ["exact match", "1 base off", "2 bases off", "3 bases off"];
  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${counts.length * rowH}`} width="100%" role="img" aria-label="Other places in the exome this guide could bind">
        {counts.map((n, i) => {
          const y = i * rowH + 5;
          const w = Math.max(2, (n / max) * (W - labelW - 40));
          const r = Math.min(4, w / 2);
          return (
            <g key={labels[i]} onMouseMove={(e: MouseEvent) => setTip({ x: e.clientX, y: e.clientY, text: `${n} coding site${n === 1 ? "" : "s"} ${labels[i]}` })} onMouseLeave={() => setTip(null)}>
              <rect x={0} y={i * rowH} width={W} height={rowH} fill="transparent" />
              <text x={labelW - 10} y={y + 12} textAnchor="end">
                {labels[i]}
              </text>
              <path d={`M${labelW},${y} H${labelW + w - r} A${r},${r} 0 0 1 ${labelW + w},${y + r} V${y + 15 - r} A${r},${r} 0 0 1 ${labelW + w - r},${y + 15} H${labelW} Z`} fill={steps[i]} />
              <text x={labelW + w + 6} y={y + 12} style={{ fill: "var(--ink)" }}>
                {n}
              </text>
            </g>
          );
        })}
      </svg>
      <TipBox tip={tip} />
    </>
  );
}

/** Exon map: coding stretches against untranslated ends, with optional cut marks. */
export function ExonMap({
  exons,
  cuts = [],
  onPick,
}: {
  exons: { number: number; length: number; codingLength: number }[];
  cuts?: { exon: number }[];
  onPick?: (exon: number) => void;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const total = exons.reduce((s, e) => s + e.length, 0);
  const W = 720;
  const H = 46;
  const gap = 2;
  const usable = W - gap * (exons.length - 1);
  let x = 0;
  const cutsPerExon = new Map<number, number>();
  for (const c of cuts) cutsPerExon.set(c.exon, (cutsPerExon.get(c.exon) ?? 0) + 1);

  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Exon map: coding and untranslated parts">
        {exons.map((e) => {
          const w = Math.max(3, (e.length / total) * usable);
          const codingW = (e.codingLength / Math.max(1, e.length)) * w;
          const left = x;
          x += w + gap;
          const n = cutsPerExon.get(e.number) ?? 0;
          return (
            <g
              key={e.number}
              onMouseMove={(ev: MouseEvent) =>
                setTip({
                  x: ev.clientX,
                  y: ev.clientY,
                  text: `Exon ${e.number}: ${e.length} bases, ${e.codingLength} coding${n ? `, ${n} guide${n > 1 ? "s" : ""} here` : ""}`,
                })
              }
              onMouseLeave={() => setTip(null)}
              onClick={() => onPick?.(e.number)}
              style={{ cursor: onPick ? "pointer" : "default" }}
            >
              <rect x={left} y={10} width={w} height={20} rx={3} fill="var(--c-2)" />
              {codingW > 0 && <rect x={left} y={6} width={codingW} height={28} rx={3} fill="var(--c-1)" />}
              {n > 0 && <circle cx={left + codingW / 2} cy={40} r={3} fill="var(--ink-2)" />}
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span className="key">
          <span className="swatch" style={{ background: "var(--c-1)" }} /> coding
        </span>
        <span className="key">
          <span className="swatch" style={{ background: "var(--c-2)" }} /> untranslated
        </span>
        {cuts.length > 0 && (
          <span className="key">
            <span className="swatch" style={{ background: "var(--ink-2)", borderRadius: "50%" }} /> exon has guides
          </span>
        )}
      </div>
      <TipBox tip={tip} />
    </>
  );
}

export const fmt = {
  int: (n: number) => n.toLocaleString("en-US"),
  kb: (n: number) => `${(n / 1000).toFixed(1)} kb`,
};
