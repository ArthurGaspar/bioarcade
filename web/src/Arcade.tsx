import { useState } from "react";
import { load, type GeneSummary, type Meta } from "./data";
import { fmt, useAsync } from "./ui";

const GAMES = [
  {
    id: "pam-hunter",
    name: "PAM Hunter",
    action: "Find the cut sites",
    description: "Spot NGG and CCN on both strands before time runs out.",
    format: "12 rounds · timed",
    color: "lime",
    sequence: ["ACG", "TGG", "CAT", "CCG"],
    annotation: "SCAN → RECOGNISE → CUT",
  },
  {
    id: "guide-duel",
    name: "Guide Duel",
    action: "Choose the stronger guide",
    description:
      "Weigh sequence quality against off-target matches. Reveal the score.",
    format: "12 pairs · untimed",
    color: "pink",
    sequence: ["GCG", "ATC", "vs", "TTT"],
    annotation: "SEQUENCE × SPECIFICITY",
  },
  {
    id: "variant-verdict",
    name: "Variant Verdict",
    action: "Follow the evidence",
    description:
      "Open ClinVar clues. Decide: pathogenic, benign, or uncertain.",
    format: "8 cases · untimed",
    color: "blue",
    sequence: ["C", "→", "T", "?"],
    annotation: "OBSERVE → QUESTION → CLASSIFY",
  },
  {
    id: "codon-runner",
    name: "Codon Runner",
    action: "Read. Delete. Translate.",
    description:
      "Translate real codons, then remove a base to explore the frameshift.",
    format: "6 rounds · practice available",
    color: "orange",
    sequence: ["ATG", "GCC", "TAA", "*"],
    annotation: "THREE BASES. ONE AMINO ACID.",
  },
] as const;

export function Arcade() {
  const { data, error } = useAsync(
    () =>
      Promise.all([load<Meta>("meta.json"), load<GeneSummary[]>("genes.json")]),
    [],
  );
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState("");
  const game = GAMES[selected];
  const genes =
    data?.[1].filter((gene) =>
      `${gene.symbol} ${gene.title}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ) ?? [];

  return (
    <>
      <section className="arcade-heading">
        <div>
          <p className="eyebrow">
            <span className="status-dot" /> HUMAN GENOME / GRCh38
          </p>
          <h1>
            Small changes.
            <br />
            <em>Big consequences.</em>
          </h1>
        </div>
        <div className="heading-note">
          <span className="specimen-mark" aria-hidden="true">
            A↔T
            <br />
            C↔G
          </span>
          <p>
            Read a sequence. Make a call.
            <br />
            See what changes.
          </p>
          <span className="small">Four games on real human gene data.</span>
        </div>
      </section>

      <section className="game-selector" aria-labelledby="game-select-title">
        <div className="section-label">
          <h2 id="game-select-title">01 / Choose your experiment</h2>
          <span>NO COINS REQUIRED</span>
        </div>
        <div className="selector-layout">
          <div className="game-list" role="group" aria-label="Games">
            {GAMES.map((item, index) => (
              <button
                key={item.id}
                className={`game-option ${selected === index ? "selected" : ""}`}
                onClick={() => setSelected(index)}
                aria-pressed={selected === index}
              >
                <span className="game-number">0{index + 1}</span>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.action}</small>
                </span>
                <span className={`game-glyph ${item.color}`} aria-hidden="true">
                  {["⌁", "⇄", "?", "↳"][index]}
                </span>
              </button>
            ))}
          </div>
          <div className={`experiment ${game.color}`}>
            <div className="experiment-top">
              <span>EXPERIMENT 0{selected + 1}</span>
              <span>{game.format}</span>
            </div>
            <div className="sequence-art" aria-hidden="true">
              <div className="sequence-axis">
                5′
                <span />
                3′
              </div>
              <div className="sequence-letters">
                {game.sequence.map((codon, i) => (
                  <span key={`${selected}-${i}`}>{codon}</span>
                ))}
              </div>
              <div className="sequence-axis">
                3′
                <span />
                5′
              </div>
              <span className="sequence-caption">{game.annotation}</span>
            </div>
            <div className="experiment-bottom" aria-live="polite">
              <div>
                <h3>{game.name}</h3>
                <p>{game.description}</p>
              </div>
              <a
                className="play-link"
                href={`#/${game.id}`}
                aria-label={`Play ${game.name}`}
              >
                Play <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="gene-collection" aria-labelledby="collection-title">
        <div className="section-label">
          <h2 id="collection-title">02 / The gene collection</h2>
          <a href="#/designer">Open guide workbench ↗</a>
        </div>
        <div className="collection-intro">
          <p>
            Go straight to the sequence.
            <br />
            <span>
              Inspect ranked CRISPR guides, exons, and coding-sequence
              off-targets.
            </span>
          </p>
          <label className="collection-search">
            <span className="sr-only">Filter gene collection</span>
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a gene or function…"
              type="search"
            />
          </label>
        </div>
        {error ? (
          <p role="alert">
            The gene collection could not load. Refresh to try again.
          </p>
        ) : !data ? (
          <p role="status">Loading gene collection…</p>
        ) : (
          <>
            <div className="gene-index">
              {genes.map((gene) => (
                <a
                  key={gene.symbol}
                  href={`#/designer?gene=${gene.symbol}`}
                  className="gene-entry"
                >
                  <span className="gene-symbol">{gene.symbol}</span>
                  <span className="gene-title">{gene.title}</span>
                  <span className="gene-count">
                    {fmt.int(gene.guidesFound)} sites{" "}
                    <span aria-hidden="true">↗</span>
                  </span>
                </a>
              ))}
            </div>
            {!genes.length && (
              <p role="status">
                No genes match “{query}”. Try a symbol such as TP53 or a
                function such as insulin.
              </p>
            )}
            <div className="collection-ledger">
              <span>
                {genes.length} / {data[1].length} GENES
              </span>
              <span>
                {fmt.int(data[0].counts.guidesChecked)} GUIDES CHECKED
              </span>
              <span>
                {fmt.int(data[0].counts.exomeSites)} CODING SITES IN INDEX
              </span>
            </div>
          </>
        )}
      </section>
      <aside className="research-note">
        <span aria-hidden="true">※</span>
        <p>
          Built for learning. Guide scores use explicit sequence rules;
          off-target counts cover coding sequence only.{" "}
          <a href="#/method">Read the method and limits ↗</a>
        </p>
      </aside>
    </>
  );
}
