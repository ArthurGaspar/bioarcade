import { useEffect, useReducer, useRef } from "react";
import { load, type CodonRound } from "../data";
import { AMINO_ACIDS, CODONS, codonOptions, deleteBase, readFrame } from "../lib/codons";
import { Empty, useAsync } from "../ui";
import { initialRunnerGame, runnerReducer } from "./runner";

export function CodonRunner() {
  const { data: rounds, error } = useAsync(() => load<CodonRound[]>("codon-runner.json"), []);
  const [game, dispatch] = useReducer(runnerReducer, initialRunnerGame);
  const heading = useRef<HTMLHeadingElement>(null);
  const labHeading = useRef<HTMLHeadingElement>(null);
  const prompt = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (game.phase !== "running" || !game.timed) return;
    const tick = () => dispatch({ type: "tick", now: performance.now() });
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [game.phase, game.timed, game.deadline]);

  useEffect(() => {
    if (game.phase === "lab") labHeading.current?.focus({ preventScroll: true });
    else if (game.phase !== "ready") heading.current?.focus();
  }, [game.phase, game.index]);

  useEffect(() => {
    if (game.phase === "running") prompt.current?.focus({ preventScroll: true });
  }, [game.phase, game.correct]);

  if (error) return <Empty title="No runs yet">{error}</Empty>;
  if (!rounds) return <Empty title="Loading the cartridge…" />;
  if (!rounds.length) return <Empty title="No runs yet">No aligned coding windows were found.</Empty>;

  const round = game.rounds[game.index];
  const start = (timed: boolean) => dispatch({ type: "start", rounds, timed, now: performance.now() });
  const left = round ? Math.max(0, (game.deadline - game.now) / 1000) : 0;
  const codon = round?.seq.slice(game.correct * 3, game.correct * 3 + 3) ?? "";
  const total = rounds.reduce((n, r) => n + r.quizCodons, 0);

  return (
    <>
      <section>
        <h1 className="pixel">Codon Runner</h1>
        <p>Read real human coding DNA, three bases at a time. Build a protein against the clock, then delete one base and see how the reading frame changes.</p>
      </section>

      {game.phase === "ready" ? (
        <section className="panel">
          <h2>Three letters. One amino acid.</h2>
          <p>{rounds.length} rounds, {rounds[0].quizCodons} codons each. Choose the amino acid encoded by the highlighted triplet: +100 for a correct answer, −25 for a wrong choice, with a score floor of zero. Wrong choices are disabled so you can try again.</p>
          <p>Each round has its own clock ({rounds[0].seconds} seconds at the start, {rounds[rounds.length - 1].seconds} in the last round). The codon reference below is always available. After completing a round or running out of time, explore a one-base deletion with no timer.</p>
          <div className="row">
            <button className="primary" onClick={() => start(true)}>Insert coin</button>
            <button className="secondary" onClick={() => start(false)}>Practice without timer</button>
          </div>
        </section>
      ) : game.phase === "finished" ? (
        <section className="panel">
          <h2 ref={heading} tabIndex={-1}>Run complete</h2>
          <p>Final score <b>{game.score.toLocaleString("en-US")}</b> · {game.totalCorrect}/{total} codons translated in {game.timed ? "timed" : "practice"} mode.</p>
          <p>One missing base shifts the groups of three downstream. Some amino acids can stay the same by chance, and a new stop can end translation early.</p>
          <div className="row">
            <button className="primary" onClick={() => start(true)}>Play again</button>
            <button className="secondary" onClick={() => start(false)}>Practice without timer</button>
            <a href="#/">Back to the arcade</a>
          </div>
        </section>
      ) : round && (
        <section className="panel runner-game">
          <div className="row runner-heading">
            <h2 ref={heading} tabIndex={-1}>Round {game.index + 1} / {game.rounds.length}</h2>
            <span className="hud">SCORE <span className="v">{game.score.toLocaleString("en-US")}</span></span>
            <span className="chip">{round.gene} · chromosome {round.chromosome} · exon {round.exon}</span>
          </div>
          <p className="small">{round.transcriptId} · coding bases {round.cdsStart + 1}–{round.cdsStart + round.seq.length} · starts at protein residue {round.cdsStart / 3 + 1}. This is an internal coding excerpt, not a whole gene.</p>

          {game.phase === "running" ? (
            <>
              <div className="row runner-heading">
                <span>{game.correct}/{round.quizCodons} codons translated · {game.mistakes} wrong choices</span>
                <span className="mono">{game.timed ? `${left.toFixed(1)}s remaining` : "Practice · no timer"}</span>
              </div>
              {game.timed && <progress className="runner-timer" max={round.seconds} value={left} aria-label="Time remaining" />}
              <div className="runner-track" aria-label="Translation progress">
                {Array.from({ length: round.quizCodons }, (_, i) => (
                  <div className={`runner-triplet ${i === game.correct ? "runner-current" : i < game.correct ? "runner-done" : ""}`} key={i} aria-current={i === game.correct ? "step" : undefined}>
                    <code>{round.seq.slice(i * 3, i * 3 + 3)}</code>
                    <span>{i < game.correct ? round.protein[i] : "·"}</span>
                  </div>
                ))}
              </div>
              <h3 className="runner-prompt" ref={prompt} tabIndex={-1}>Codon {game.correct + 1}: what does <code>{codon}</code> encode?</h3>
              <p className="small">Coding DNA 5′→3′ · RNA equivalent: <code>{codon.replaceAll("T", "U")}</code></p>
              <div className="runner-options" role="group" aria-label="Choose an amino acid" key={`${game.index}-${game.correct}`}>
                {codonOptions(codon, game.correct).map((amino) => (
                  <button className="secondary" key={amino} disabled={game.attempts.includes(amino)}
                    onClick={() => dispatch({ type: "answer", amino, codonIndex: game.correct, now: performance.now() })}>
                    <b className="mono">{amino === "*" ? "STOP" : amino}</b> {AMINO_ACIDS[amino]}{game.attempts.includes(amino) ? " · Try another" : ""}
                  </button>
                ))}
              </div>
              <p className="runner-feedback" role="status">{game.message || "Choose an answer, or use the reference below."}</p>
            </>
          ) : (
            <>
              <h3 ref={labHeading} tabIndex={-1}>{game.timedOut ? "Time is up" : "Translation cleared"} · Frameshift lab</h3>
              <p>{game.correct}/{round.quizCodons} codons translated. The clock is off. Choose a base in the first {round.quizCodons} codons to delete, then compare the original and edited reading frames.</p>
              <p className="small">Each click makes one deletion from the original sequence. This is a hypothetical edit, not a known clinical variant.</p>
              <div className="runner-delete" role="group" aria-label="Choose one base to delete">
                {Array.from({ length: round.quizCodons }, (_, i) => (
                  <div className="runner-delete-codon" key={i}>
                    {[0, 1, 2].map((j) => {
                      const position = i * 3 + j;
                      return <button className="secondary mono" key={j} aria-pressed={game.deletion === position}
                        aria-label={`Delete base ${position + 1}, ${round.seq[position]}`}
                        onClick={() => dispatch({ type: "delete", position })}>{round.seq[position]}</button>;
                    })}
                  </div>
                ))}
              </div>
              <Frameshift round={round} deletion={game.deletion} />
              <div className="row runner-lab-actions">
                <button className="secondary" disabled={game.deletion === null} onClick={() => dispatch({ type: "delete", position: null })}>Restore original</button>
                <button className="primary" disabled={game.deletion === null} onClick={() => dispatch({ type: "next", now: performance.now() })}>{game.index + 1 === game.rounds.length ? "See final score" : "Next round"}</button>
                {game.deletion === null && <span className="small">Delete a base to continue.</span>}
              </div>
            </>
          )}
        </section>
      )}

      <section className="panel">
        <h2>Codon reference · standard nuclear code</h2>
        <p>Match three DNA letters to one amino acid. RNA uses U in place of T. A stop codon ends translation and adds no amino acid; an incomplete triplet also adds none.</p>
        <details className="runner-reference">
          <summary>Open the codon reference</summary>
          <dl>{Object.entries(AMINO_ACIDS).map(([amino, name]) => (
            <div key={amino}><dt><b>{amino === "*" ? "STOP" : amino}</b> · {name}</dt><dd className="mono">{Object.entries(CODONS).filter(([, a]) => a === amino).map(([dna]) => dna).join(" ")}</dd></div>
          ))}</dl>
        </details>
        <p className="small">Excerpts come from the project's Ensembl GRCh38 canonical transcripts, aligned to their coding reading frame. They are already on the coding strand, including genes on the minus genomic strand. Translation here continues an existing reading frame; it does not model initiation, RNA decay, or protein function. <a href="https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi#SG1">NCBI standard code</a>.</p>
      </section>
    </>
  );
}

function Frameshift({ round, deletion }: { round: CodonRound; deletion: number | null }) {
  const edited = deletion === null ? round.seq : deleteBase(round.seq, deletion);
  const frame = readFrame(edited);
  return (
    <>
      <p className="callout runner-edit-status" role="status">{deletion === null
        ? "Original frame restored. Select one base above to explore a deletion."
        : `Deleted ${round.seq[deletion]} at displayed base ${deletion + 1} (coding base ${round.cdsStart + deletion + 1}). Triplet grouping shifts from displayed codon ${Math.floor(deletion / 3) + 1}.`}</p>
      <div className="grid-2 runner-comparison">
        <Frame title="Original" seq={round.seq} />
        <Frame title={deletion === null ? "Edited · no deletion" : "Edited · one base deleted"} seq={edited} shiftedFrom={deletion === null ? undefined : Math.floor(deletion / 3)} />
      </div>
      {deletion !== null && <p className="small runner-stop-note">{frame.stop >= 0
        ? `The edited frame reaches a stop at displayed codon ${frame.stop + 1}. Later triplets are shown dimmed and are not translated.`
        : "No stop appears in this edited window. The altered frame continues beyond the excerpt; a frameshift does not guarantee an immediate stop."} Some amino acids may match by chance. The two trailing bases are not a complete codon.</p>}
    </>
  );
}

function Frame({ title, seq, shiftedFrom }: { title: string; seq: string; shiftedFrom?: number }) {
  const frame = readFrame(seq);
  return (
    <article className="runner-frame" aria-label={`${title} reading frame`}>
      <h3>{title}</h3>
      <div className="runner-track">
        {frame.codons.map((c, i) => (
          <div key={i} className={`runner-triplet ${c.afterStop ? "runner-after-stop" : c.amino === "*" ? "runner-stop" : shiftedFrom !== undefined && i >= shiftedFrom ? "runner-shifted" : ""}`}
            title={c.afterStop ? "After stop: not translated" : `${c.dna}: ${AMINO_ACIDS[c.amino] ?? "Unknown"}`}>
            <code>{c.dna}</code><span>{c.afterStop ? "—" : c.amino === "*" ? "STOP" : c.amino}</span>
          </div>
        ))}
      </div>
      <p className="small">Protein excerpt (one-letter code): <code className="runner-protein">{frame.protein || "No amino acids before the stop"}</code></p>
      {frame.trailing && <p className="small">Unpaired tail: <code>{frame.trailing}</code> · not translated</p>}
    </article>
  );
}
