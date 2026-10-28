import { load, type Meta } from "./data";
import { Tile, fmt, useAsync } from "./ui";

/** The four cabinets. PAM Hunter is built; the rest are specified and planned. */
const GAMES = [
  {
    id: "pam-hunter",
    name: "PAM Hunter",
    href: "#/pam-hunter",
    status: "playable" as const,
    blurb: "Real coding sequence scrolls in. Click every spot where Cas9 is allowed to cut, before the clock runs out.",
    teaches: "Where an edit can go at all, and why PAMs come first.",
    art: <PamArt />,
  },
  {
    id: "guide-duel",
    name: "Guide Duel",
    href: null,
    status: "planned" as const,
    blurb: "Two real guides for the same exon, side by side. Pick the better one, then watch the score break down.",
    teaches: "Reading GC content, poly-T, the seed region and off-target counts.",
    art: <DuelArt />,
  },
  {
    id: "variant-verdict",
    name: "Variant Verdict",
    href: null,
    status: "planned" as const,
    blurb: "A real variant from a real gene. Pathogenic or benign? Clues unlock one at a time, and guessing early scores more.",
    teaches: "How clinical databases classify a change, and how often it is genuinely uncertain.",
    art: <VerdictArt />,
  },
  {
    id: "codon-runner",
    name: "Codon Runner",
    href: null,
    status: "planned" as const,
    blurb: "Translate a real coding sequence against the clock, then delete one base and watch the protein fall apart.",
    teaches: "The genetic code, reading frames, and why frameshifts are so destructive.",
    art: <CodonArt />,
  },
];

export function Arcade() {
  const { data: meta } = useAsync(() => load<Meta>("meta.json"), []);

  return (
    <>
      <section>
        <h1 className="pixel">BioArcade</h1>
        <p>
          Four games about reading and editing the human genome, all played on real data. A Python pipeline pulls genes from
          Ensembl, finds every place the CRISPR enzyme Cas9 could cut, scores the guide RNAs, and checks each one against every
          human protein-coding sequence for places it might cut by mistake.
        </p>
      </section>

      {meta && (
        <div className="tiles">
          <Tile value={meta.counts.genes} label="Genes analysed" sub="canonical transcripts from Ensembl" />
          <Tile value={fmt.int(meta.counts.guidesFound)} label="Cut sites found" sub={`${fmt.int(meta.counts.guidesChecked)} checked for off-targets`} />
          <Tile value={fmt.int(meta.counts.exomeSites)} label="Sites in the search index" sub="every NGG site in the human exome" />
          <Tile value="$0" label="Running cost" sub="static files on GitHub Pages" />
        </div>
      )}

      <section>
        <h2>Cabinets</h2>
        <div className="cabinets">
          {GAMES.map((g) =>
            g.href ? (
              <a className="cabinet playable" href={g.href} key={g.id}>
                <span className="tag">Play</span>
                <div className="screen">{g.art}</div>
                <h3>{g.name}</h3>
                <p className="small" style={{ margin: 0 }}>
                  {g.blurb}
                </p>
                <p className="small" style={{ margin: 0, color: "var(--ink-3)" }}>
                  Teaches: {g.teaches}
                </p>
              </a>
            ) : (
              <div className="cabinet soon" key={g.id}>
                <span className="tag">Planned</span>
                <div className="screen">{g.art}</div>
                <h3>{g.name}</h3>
                <p className="small" style={{ margin: 0 }}>
                  {g.blurb}
                </p>
                <p className="small" style={{ margin: 0, color: "var(--ink-3)" }}>
                  Teaches: {g.teaches}
                </p>
              </div>
            ),
          )}
        </div>
      </section>

      <section className="panel">
        <h2>Not a game</h2>
        <h3>Guide designer</h3>
        <p>
          The tool underneath the arcade. Pick one of the analysed genes to see its ranked guide RNAs with every scoring decision
          written out and off-target counts across the exome, or type any human gene symbol and the browser will fetch it from
          Ensembl and score it live.
        </p>
        <a className="primary" href="#/designer" style={{ display: "inline-block", textDecoration: "none" }}>
          Open the designer
        </a>
      </section>
    </>
  );
}

/* Small inline screens for the cabinets. Decorative, so they are hidden from screen readers. */

function PamArt() {
  const seq = "ACGTTAGGCATGGCCTAAGG";
  return (
    <svg viewBox="0 0 160 120" width="100%" aria-hidden="true">
      {[...seq].map((b, i) => (
        <text
          key={i}
          x={10 + (i % 10) * 14}
          y={46 + Math.floor(i / 10) * 24}
          fontFamily="monospace"
          fontSize="13"
          fill={i === 6 || i === 17 ? "var(--c-1)" : "#5b6786"}
          fontWeight={i === 6 || i === 17 ? 700 : 400}
        >
          {b}
        </text>
      ))}
      <rect x={76} y={30} width={40} height={20} rx={3} fill="none" stroke="var(--c-1)" strokeWidth="2" />
      <text x={80} y={96} fontFamily="monospace" fontSize="11" fill="var(--c-1)">
        PAM!
      </text>
    </svg>
  );
}

function DuelArt() {
  return (
    <svg viewBox="0 0 160 120" width="100%" aria-hidden="true">
      <rect x={16} y={28} width={54} height={64} rx={5} fill="none" stroke="var(--c-1)" strokeWidth="2" />
      <rect x={90} y={28} width={54} height={64} rx={5} fill="none" stroke="var(--c-2)" strokeWidth="2" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={24} y={38 + i * 14} width={38 - i * 8} height={6} rx={3} fill="var(--c-1)" />
      ))}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={98} y={38 + i * 14} width={20 + i * 8} height={6} rx={3} fill="var(--c-2)" />
      ))}
      <text x={72} y={64} fontFamily="monospace" fontSize="12" fill="#8691ad">
        vs
      </text>
    </svg>
  );
}

function VerdictArt() {
  return (
    <svg viewBox="0 0 160 120" width="100%" aria-hidden="true">
      <rect x={20} y={52} width={120} height={10} rx={5} fill="#2a3450" />
      <rect x={20} y={52} width={56} height={10} rx={5} fill="var(--c-1)" />
      <circle cx={76} cy={57} r={9} fill="var(--c-2)" />
      <text x={20} y={86} fontFamily="monospace" fontSize="11" fill="#8691ad">
        c.1521_1523del
      </text>
      <text x={20} y={40} fontFamily="monospace" fontSize="11" fill="var(--c-1)">
        ?
      </text>
    </svg>
  );
}

function CodonArt() {
  return (
    <svg viewBox="0 0 160 120" width="100%" aria-hidden="true">
      {["ATG", "GCC", "TAA"].map((c, i) => (
        <g key={c}>
          <rect x={14 + i * 46} y={38} width={40} height={24} rx={4} fill="none" stroke="var(--c-1)" strokeWidth="2" />
          <text x={20 + i * 46} y={55} fontFamily="monospace" fontSize="13" fill="var(--c-1)">
            {c}
          </text>
        </g>
      ))}
      {["M", "A", "*"].map((a, i) => (
        <text key={i} x={30 + i * 46} y={84} fontFamily="monospace" fontSize="14" fill="#8691ad">
          {a}
        </text>
      ))}
    </svg>
  );
}
