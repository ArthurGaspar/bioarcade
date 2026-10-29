import { useEffect, useRef, useState } from "react";
import { load, type DuelRound, type Guide, type Meta } from "../data";
import { Empty, useAsync } from "../ui";

type Phase = "ready" | "playing" | "revealed" | "finished";
interface Game {
  phase: Phase;
  rounds: DuelRound[];
  answers: number[];
}
const initial: Game = { phase: "ready", rounds: [], answers: [] };

/** Shuffle a copy, including which side wins, so replaying cannot rely on position. */
export function shuffleDuels(rounds: DuelRound[]): DuelRound[] {
  const deck = rounds.map((round): DuelRound => Math.random() < 0.5
    ? { ...round, guides: [round.guides[1], round.guides[0]], winner: round.winner === 0 ? 1 : 0 }
    : { ...round });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

const gc = (sequence: string) => Math.round([...sequence].filter((b) => b === "G" || b === "C").length / sequence.length * 100);

export function GuideDuel() {
  const { data, error } = useAsync(() => Promise.all([
    load<DuelRound[]>("guide-duel.json"), load<Meta>("meta.json"),
  ]), []);
  const [game, setGame] = useState<Game>(initial);
  const focus = useRef<HTMLHeadingElement>(null);
  const advance = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (game.phase === "revealed") advance.current?.focus({ preventScroll: true });
    else if (game.phase !== "ready") focus.current?.focus();
  }, [game.phase, game.answers.length]);

  if (error) return <Empty title="No duels yet">{error}</Empty>;
  if (!data) return <Empty title="Loading the cartridge…" />;
  const [rounds, meta] = data;
  if (!rounds.length) return <Empty title="No duels yet">No comparable guides were found in the analysed genes.</Empty>;

  const correct = game.answers.filter((answer, i) => answer === game.rounds[i].winner).length;
  const revealed = game.phase === "revealed";
  const index = game.answers.length - (revealed ? 1 : 0);
  const round = game.rounds[index];
  const choose = (choice: number) => setGame((current) => current.phase !== "playing" ? current : {
    ...current, phase: "revealed", answers: [...current.answers, choice],
  });

  return (
    <>
      <section>
        <h1 className="pixel">Guide Duel</h1>
        <p>Two real CRISPR guides. One exon. Pick the stronger candidate using its sequence and the places it could bind by mistake.</p>
      </section>

      {game.phase === "ready" ? (
        <section className="panel">
          <h2>Read the guides. Make the call.</h2>
          <p>{rounds.length} duels, 100 points per correct answer, and no timer. Each pair has a winner with a higher sequence score or specificity, and an equal or better result on the other measure.</p>
          <p>The totals stay hidden until you choose. Then both guides reveal every scoring adjustment.</p>
          <button className="primary" onClick={() => setGame({ phase: "playing", rounds: shuffleDuels(rounds), answers: [] })}>Insert coin</button>
        </section>
      ) : game.phase === "finished" ? (
        <section className="panel duel-finish">
          <h2 className="pixel" ref={focus} tabIndex={-1}>Duel complete</h2>
          <p>Final score <b>{correct * 100}</b> · {correct}/{game.rounds.length} correct.</p>
          <p>{correct === game.rounds.length ? "Perfect run! You read every matchup correctly." : "Every duel is a chance to learn what makes a guide stronger. Try again with the matchups shuffled."}</p>
          <div className="row">
            <button className="primary" onClick={() => setGame({ phase: "playing", rounds: shuffleDuels(rounds), answers: [] })}>Play again</button>
            <a href="#/designer">Explore the guide designer</a>
          </div>
        </section>
      ) : round && (
        <section className="panel">
          <div className="row duel-heading">
            <h2 ref={focus} tabIndex={-1}>Duel {index + 1} / {game.rounds.length}</h2>
            <span className="hud">SCORE <span className="v">{correct * 100}</span></span>
            <span className="chip">{round.gene} · chromosome {round.chromosome} · exon {round.exon}</span>
          </div>
          <p>Which guide would you choose for this exon?</p>
          <div className="grid-2 duel-cards">
            {round.guides.map((guide, i) => (
              <GuideCard key={`${index}-${i}`} guide={guide} label={i === 0 ? "A" : "B"}
                revealed={revealed} winner={round.winner === i}
                selected={revealed && game.answers[index] === i} baseScore={meta.method.baseScore}
                onChoose={() => choose(i)} />
            ))}
          </div>
          {revealed && (
            <div className="callout duel-verdict" role="status">
              <h3>{game.answers[index] === round.winner ? "Correct! +100" : "Not this time."} Guide {round.winner === 0 ? "A" : "B"} wins.</h3>
              <p>{round.lesson === "sequence"
                ? `Its sequence score is higher (${round.guides[round.winner].score} vs ${round.guides[1 - round.winner].score}), with specificity at least as high. Compare the rule adjustments above.`
                : `Both guides score ${round.guides[0].score} on sequence rules. The winner has higher specificity (${round.guides[round.winner].specificity} vs ${round.guides[1 - round.winner].specificity}) because its weighted off-target penalty is lower.`}</p>
              <button ref={advance} className="primary" onClick={() => setGame((current) => current.phase !== "revealed" ? current : {
                ...current, phase: current.answers.length === current.rounds.length ? "finished" : "playing",
              })}>{game.answers.length === game.rounds.length ? "See final score" : "Next duel"}</button>
            </div>
          )}
        </section>
      )}

      <section className="panel">
        <h2>How to read a guide</h2>
        <p>A balanced GC content (40–70%) helps pairing. Four consecutive Ts can stop U6-driven transcription early. A final G or C next to the PAM helps binding; starting with G helps the U6 promoter. Long runs of one base and a very GC-rich seed lose points.</p>
        <p>The highlighted <b>seed</b> is the eight bases closest to the PAM. The PAM is shown separately and is not part of the 20-base spacer. Sequences use DNA letters (T stands for U in the guide RNA).</p>
        <p>Specificity starts at 100: each extra exact match costs 40 points, then each match with 1, 2 or 3 mismatches costs 15, 4 or 1 point respectively, down to zero. Your intended site is excluded from the counts shown here.</p>
        <p className="small">These are teaching rules, not measured editing efficiency. Off-target counts cover coding sequence only, include possible splice-junction artefacts, and miss non-coding sites. Only fully coding guides are used in these duels. <a href="#/method">Read the method</a>.</p>
      </section>
    </>
  );
}

function GuideCard({ guide, label, revealed, winner, selected, baseScore, onChoose }: {
  guide: Guide; label: string; revealed: boolean; winner: boolean; selected: boolean;
  baseScore: number; onChoose: () => void;
}) {
  const otherMatches = [Math.max(0, guide.offTargets[0] - 1), ...guide.offTargets.slice(1)];
  return (
    <article className={`duel-card ${revealed && winner ? "duel-winner" : ""}`} aria-label={`Guide ${label}`}>
      <div className="row duel-heading">
        <h3>Guide {label}</h3>
        {revealed && <span className="chip">{winner ? "Winner" : "Lower ranked"}{selected ? " · Your pick" : ""}</span>}
      </div>
      <p className="duel-sequence mono" aria-label={`Spacer ${guide.spacer}, PAM ${guide.pam}`}>
        {guide.spacer.slice(0, -8)}<mark>{guide.spacer.slice(-8)}</mark><span className="duel-pam">{guide.pam}</span>
      </p>
      <p className="small">Spacer 5′→3′ · seed highlighted · PAM in orange<br />Transcript strand {guide.strand} · cut offset {guide.cut} in coding sequence (0-based)</p>
      <dl className="duel-traits">
        <div><dt>GC content</dt><dd>{gc(guide.spacer)}%</dd></div>
        <div><dt>Poly-T (TTTT)</dt><dd>{guide.spacer.includes("TTTT") ? "Present" : "Absent"}</dd></div>
        <div><dt>Seed GC</dt><dd>{gc(guide.spacer.slice(-8))}%</dd></div>
      </dl>
      <h3>Other coding sites</h3>
      <table className="duel-counts">
        <caption className="small">Number of bases that differ from this guide</caption>
        <thead><tr>{["Exact", "1 base", "2 bases", "3 bases"].map((text) => <th key={text} scope="col">{text}</th>)}</tr></thead>
        <tbody><tr>{otherMatches.map((count, i) => <td key={i}>{count.toLocaleString("en-US")}</td>)}</tr></tbody>
      </table>
      {!revealed ? <button className="primary" onClick={onChoose}>Choose guide {label}</button> : (
        <div className="duel-breakdown">
          <h3>Sequence score: {guide.score}/100</h3>
          <p className="small">Starts at {baseScore}; the final sequence score is clamped to 0–100.</p>
          <ul className="duel-rules">{guide.reasons.filter((reason) => /\([+-]\d+\)$/.test(reason)).map((reason) => <li key={reason}>{reason}</li>)}</ul>
          <h3>Specificity: {guide.specificity}/100</h3>
          <p className="small">100 − ({otherMatches[0]} × 40 + {otherMatches[1]} × 15 + {otherMatches[2]} × 4 + {otherMatches[3]} × 1), clamped to 0–100.</p>
        </div>
      )}
    </article>
  );
}
