import { useEffect, useReducer, useRef } from "react";
import { load, type Verdict, type VerdictRound, type VerdictSnapshot } from "../data";
import { Empty, useAsync } from "../ui";
import { availablePoints, initialVerdictGame, shuffleVerdicts, verdictLabels, verdictReducer } from "./verdict";

export function VariantVerdict() {
  const { data, error } = useAsync(() => load<VerdictSnapshot>("variant-verdict.json"), []);
  const [game, dispatch] = useReducer(verdictReducer, initialVerdictGame);
  const heading = useRef<HTMLHeadingElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (game.phase === "revealed") nextButton.current?.focus({ preventScroll: true });
    else if (game.phase !== "ready") heading.current?.focus();
  }, [game.phase, game.index]);

  if (error) return <Empty title="No cases yet">{error}</Empty>;
  if (!data) return <Empty title="Loading the case files…" />;
  if (!data.rounds.length) return <Empty title="No cases yet">The variant cartridge has no cases.</Empty>;

  const start = () => dispatch({ type: "start", rounds: shuffleVerdicts(data.rounds) });
  const score = game.answers.reduce((total, answer) => total + answer.points, 0);
  const correct = game.answers.filter((answer) => answer.points > 0).length;
  const round = game.rounds[game.index];
  const revealed = game.phase === "revealed";
  const answer = game.answers[game.index];

  return (
    <>
      <section>
        <h1 className="pixel">Variant Verdict</h1>
        <p>A real DNA change. A trail of evidence. Reveal clues, weigh what they tell you, and match the recorded ClinVar classification.</p>
      </section>

      {game.phase === "ready" ? (
        <section className="panel">
          <h2>Open a case. Weigh the evidence.</h2>
          <p>{data.rounds.length} shuffled cases. The first clue is free: a correct verdict earns 300 points. Reveal another clue for 200, or all three for 100. Wrong answers and skipped cases earn zero. There is no timer.</p>
          <p>“Uncertain / conflicting” is a real answer, worth the same points as the other verdicts. It means the record lacks a settled interpretation; it is different from skipping a case.</p>
          <button className="primary" onClick={start}>Insert coin</button>
        </section>
      ) : game.phase === "finished" ? (
        <section className="panel">
          <h2 ref={heading} tabIndex={-1}>Cases closed</h2>
          <p>Final score <b>{score.toLocaleString("en-US")}</b> / {game.rounds.length * 300} · {correct}/{game.rounds.length} correct.</p>
          <p>Using more clues trades arcade points for more evidence. In real interpretation, gathering the evidence is the goal.</p>
          <button className="primary" onClick={start}>Play again</button>
          <h3 className="verdict-review-title">Review your cases</h3>
          <div className="verdict-review">
            {game.rounds.map((caseFile, i) => {
              const result = game.answers[i];
              return <details key={caseFile.id}>
                <summary>{caseFile.gene} · {caseFile.protein} · {result.points > 0 ? "Correct" : result.choice === null ? "Skipped" : "Incorrect"} · +{result.points}</summary>
                <p className="small">Your answer: {result.choice === null ? "Skipped" : verdictLabels[result.choice]} · {result.cluesUsed} clue(s) used.</p>
                <CaseVerdict round={caseFile} />
              </details>;
            })}
          </div>
        </section>
      ) : round && (
        <section className="panel verdict-case">
          <div className="row verdict-heading">
            <h2 ref={heading} tabIndex={-1}>Case {game.index + 1} / {game.rounds.length}</h2>
            <span className="hud">SCORE <span className="v">{score.toLocaleString("en-US")}</span></span>
            <span className="chip">{revealed ? `+${answer.points} points` : `${availablePoints(game.cluesShown)} points available`}</span>
          </div>
          <h3>{round.gene} <span className="mono">{round.dna}</span></h3>
          <p className="verdict-protein mono">{round.protein}</p>
          <p className="small">Transcript {round.transcript} · Disease context: {round.context}<br />Classification scope: {round.scope}</p>

          <ol className="verdict-clues" aria-label="Evidence clues" aria-live="polite" aria-relevant="additions text">
            {round.clues.map((clue, i) => (
              <li key={`${round.id}-${i}`} className={revealed || i < game.cluesShown ? "" : "verdict-locked"}>
                <h3>Clue {i + 1}{revealed || i < game.cluesShown ? ` · ${clue.title}` : " · Locked"}</h3>
                <p>{revealed || i < game.cluesShown ? clue.text : "Reveal the next clue to see this evidence."}</p>
              </li>
            ))}
          </ol>

          {!revealed ? (
            <>
              <div className="row verdict-tools">
                <button className="secondary" disabled={game.cluesShown === round.clues.length} onClick={() => dispatch({ type: "clue" })}>
                  {game.cluesShown === round.clues.length ? "All clues revealed" : "Reveal next clue (−100 points)"}
                </button>
                <span className="small">{game.cluesShown}/{round.clues.length} clues revealed</span>
              </div>
              <fieldset className="verdict-choices">
                <legend>Which bucket matches this ClinVar record?</legend>
                {(Object.keys(verdictLabels) as Verdict[]).map((choice) => (
                  <button className="secondary" key={choice} onClick={() => dispatch({ type: "answer", choice })}>{verdictLabels[choice]}</button>
                ))}
              </fieldset>
              <button className="secondary" onClick={() => dispatch({ type: "answer", choice: null })}>Skip case (0 points)</button>
            </>
          ) : (
            <div className="callout verdict-result">
              <p role="status"><b>{answer.points > 0 ? `Correct! +${answer.points} points.` : answer.choice === null ? "Case skipped. +0 points." : "Not this time. +0 points."}</b> {answer.choice !== null && `Your verdict: ${verdictLabels[answer.choice]}.`}</p>
              <CaseVerdict round={round} />
              <button ref={nextButton} className="primary" onClick={() => dispatch({ type: "next" })}>{game.index + 1 === game.rounds.length ? "See final score" : "Next case"}</button>
            </div>
          )}
        </section>
      )}

      <section className="panel">
        <h2>Evidence before certainty</h2>
        <p>The game groups pathogenic with likely pathogenic, benign with likely benign, and uncertain significance with conflicting classifications. A VUS means insufficient evidence; conflicting classifications mean submitters disagree. The exact label and review status appear after your answer.</p>
        <p>Interpretations depend on the condition and can change as evidence grows. A protein change, rarity, or one computer prediction cannot settle every case. A classification describes a variant in context; it does not diagnose a person.</p>
        <p className="small">Educational snapshot reviewed {data.reviewedAt}. These are curated summaries of <a href="https://www.ncbi.nlm.nih.gov/clinvar/">ClinVar</a> records, not live classifications or medical advice. Every revealed case links to its source.</p>
      </section>
    </>
  );
}

function CaseVerdict({ round }: { round: VerdictRound }) {
  return (
    <>
      <h3>Recorded classification: {round.classification}</h3>
      <p>{round.explanation}</p>
      <p className="small">{round.reviewStatus}<br />{round.scope} · <a href={round.sourceUrl} target="_blank" rel="noreferrer">ClinVar {round.accession}</a></p>
    </>
  );
}
