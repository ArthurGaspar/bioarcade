import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { load, type Round } from "../data";
import { Empty, useAsync } from "../ui";

/**
 * Click the first base of every PAM. Cas9 only cuts where it finds NGG just
 * past the 20-base target, so finding PAMs is the first thing anyone designing
 * a guide does. Every sequence here is real coding sequence from a real gene.
 */

type Phase = "ready" | "playing" | "round-over" | "finished";

interface Marks {
  hits: Set<number>;
  wrong: Set<number>;
}

const HIT = 100;
const WRONG = -40;
const SPEED_BONUS = 10; // per second left when a round is cleared

export function PamHunter() {
  const { data: rounds, error } = useAsync(() => load<Round[]>("pam-hunter.json"), []);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [marks, setMarks] = useState<Marks>({ hits: new Set(), wrong: new Set() });
  const [left, setLeft] = useState(0);
  const deadline = useRef(0);

  const round = rounds?.[index];
  const targets = useMemo(() => new Set((round?.pams ?? []).map((p) => p.pos)), [round]);

  const endRound = useCallback(() => {
    setPhase((p) => (p === "playing" ? "round-over" : p));
  }, []);

  useEffect(() => {
    if (phase !== "playing" || !round) return;
    deadline.current = performance.now() + round.seconds * 1000;
    setLeft(round.seconds);
    const id = setInterval(() => {
      const remaining = Math.max(0, (deadline.current - performance.now()) / 1000);
      setLeft(remaining);
      if (remaining <= 0) endRound();
    }, 100);
    return () => clearInterval(id);
  }, [phase, round, endRound]);

  useEffect(() => {
    if (phase === "playing" && round && marks.hits.size === targets.size && targets.size > 0) {
      setScore((s) => s + Math.round(left) * SPEED_BONUS);
      endRound();
    }
  }, [marks, targets, phase, round, left, endRound]);

  if (error) return <Empty title="No rounds yet">{error}</Empty>;
  if (!rounds || !round) return <Empty title="Loading the cartridge…" />;

  const start = () => {
    setMarks({ hits: new Set(), wrong: new Set() });
    setPhase("playing");
  };

  const next = () => {
    if (index + 1 >= rounds.length) {
      setPhase("finished");
      return;
    }
    setIndex(index + 1);
    setMarks({ hits: new Set(), wrong: new Set() });
    setPhase("playing");
  };

  const restart = () => {
    setIndex(0);
    setScore(0);
    setMarks({ hits: new Set(), wrong: new Set() });
    setPhase("ready");
  };

  const click = (pos: number) => {
    if (phase !== "playing") return;
    if (marks.hits.has(pos) || marks.wrong.has(pos)) return;
    if (targets.has(pos)) {
      setScore((s) => s + HIT);
      setMarks((m) => ({ ...m, hits: new Set(m.hits).add(pos) }));
    } else {
      setScore((s) => Math.max(0, s + WRONG));
      setMarks((m) => ({ ...m, wrong: new Set(m.wrong).add(pos) }));
    }
  };

  const missed = [...targets].filter((t) => !marks.hits.has(t));

  if (phase === "finished") {
    return (
      <section className="panel" style={{ textAlign: "center" }}>
        <h1 className="pixel">Game over</h1>
        <p style={{ margin: "0 auto 14px" }}>
          Final score <b>{score.toLocaleString("en-US")}</b> across {rounds.length} rounds of real human coding sequence.
        </p>
        <button className="primary" onClick={restart}>
          Play again
        </button>
      </section>
    );
  }

  return (
    <>
      <section>
        <h1 className="pixel">PAM Hunter</h1>
        <p>
          Cas9 can only cut next to a <b>PAM</b>: the three letters <code>NGG</code>, where N is any base. Click the{" "}
          <b>first letter of every PAM</b> before the timer runs out. Both strands count, so <code>CCN</code> read forwards is a
          PAM on the strand underneath.
        </p>
      </section>

      <section className="panel">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <div className="hud">
            <span>
              ROUND <span className="v">{index + 1}/{rounds.length}</span>
            </span>
            <span>
              SCORE <span className="v">{score.toLocaleString("en-US")}</span>
            </span>
            <span>
              FOUND <span className="v">{marks.hits.size}/{targets.size}</span>
            </span>
            <span>
              TIME <span className="v">{left.toFixed(1)}s</span>
            </span>
          </div>
          <span className="chip">
            {round.gene} · chromosome {round.chromosome} · exon {round.exon}
          </span>
        </div>
        <div className="timer" aria-hidden="true">
          <div style={{ width: `${phase === "playing" ? (left / round.seconds) * 100 : 0}%` }} />
        </div>

        <div className="strip" role="group" aria-label="DNA sequence" style={{ marginTop: 14 }}>
          {[...round.seq].map((base, i) => {
            const isTarget = targets.has(i);
            const shown = phase === "round-over";
            const cls = marks.hits.has(i)
              ? "hit"
              : marks.wrong.has(i)
                ? "wrong"
                : shown && isTarget
                  ? "miss"
                  : "";
            return (
              <button
                key={i}
                className={`base ${cls} ${isTarget && shown ? "pam" : ""}`}
                onClick={() => click(i)}
                disabled={phase !== "playing"}
                aria-label={`Base ${i + 1}, ${base}`}
                title={`position ${i + 1}`}
              >
                {base}
              </button>
            );
          })}
        </div>

        <div className="legend" style={{ marginTop: 12 }}>
          <span className="key">
            <span className="swatch" style={{ background: "var(--c-1)" }} /> found
          </span>
          <span className="key">
            <span className="swatch" style={{ background: "var(--c-2)" }} /> wrong click ({WRONG})
          </span>
          <span className="key">
            <span className="swatch" style={{ background: "var(--c-3)" }} /> missed, shown after the round
          </span>
        </div>

        <div className="row" style={{ marginTop: 16 }}>
          {phase === "ready" && (
            <button className="primary" onClick={start}>
              Insert coin
            </button>
          )}
          {phase === "round-over" && (
            <>
              <button className="primary" onClick={next}>
                {index + 1 >= rounds.length ? "See final score" : "Next round"}
              </button>
              <span className="small">
                {missed.length === 0
                  ? `Every PAM found, with ${left.toFixed(1)}s to spare (+${Math.round(left) * SPEED_BONUS}).`
                  : `${missed.length} PAM${missed.length > 1 ? "s" : ""} missed, now marked in green.`}
              </span>
            </>
          )}
        </div>
      </section>

      <section className="panel">
        <h2>Why this matters</h2>
        <p>
          A guide RNA is 20 bases long and must sit directly in front of a PAM, so the PAMs decide where in a gene you can cut at
          all. Cas9 cuts 3 bases in from the PAM, which is why an edit lands where it does. In this round there{" "}
          {targets.size === 1 ? "is 1 site" : `are ${targets.size} sites`} in {round.seq.length} bases, and the whole sequence is
          real: {round.gene}, exon {round.exon}, from Ensembl.
        </p>
      </section>
    </>
  );
}
