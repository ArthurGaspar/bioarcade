import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { VerdictRound, VerdictSnapshot } from "../data";
import { initialVerdictGame, shuffleVerdicts, verdictReducer } from "./verdict";

const snapshot = JSON.parse(readFileSync(new URL("../../../data/variants.json", import.meta.url), "utf8")) as VerdictSnapshot;
const sample: VerdictRound = { ...snapshot.rounds[0], verdict: "pathogenic" };
const start = () => verdictReducer(initialVerdictGame, { type: "start", rounds: [sample] });

describe("Variant Verdict transitions", () => {
  it.each([1, 2, 3])("awards points for the clues actually revealed: %i", (clues) => {
    let game = start();
    for (let i = 1; i < clues; i++) game = verdictReducer(game, { type: "clue" });
    game = verdictReducer(game, { type: "answer", choice: "pathogenic" });
    expect(game.answers).toEqual([{ choice: "pathogenic", cluesUsed: clues, points: 400 - clues * 100 }]);
    expect(verdictReducer(game, { type: "answer", choice: "pathogenic" })).toBe(game);
    expect(verdictReducer(game, { type: "clue" })).toBe(game);
  });

  it("caps clues, rejects premature advancement and gives no points for errors or skips", () => {
    let game = start();
    expect(verdictReducer(game, { type: "next" })).toBe(game);
    for (let i = 0; i < 10; i++) game = verdictReducer(game, { type: "clue" });
    expect(game.cluesShown).toBe(3);
    expect(verdictReducer(game, { type: "answer", choice: "benign" }).answers[0].points).toBe(0);
    expect(verdictReducer(game, { type: "answer", choice: null }).answers[0]).toEqual({ choice: null, cluesUsed: 3, points: 0 });
  });

  it("gives an uncertain verdict full credit instead of treating it as a skip", () => {
    const game = verdictReducer(initialVerdictGame, { type: "start", rounds: [{ ...sample, verdict: "uncertain" }] });
    expect(verdictReducer(game, { type: "answer", choice: "uncertain" }).answers[0].points).toBe(300);
  });

  it("resets clues between cases, finishes after the last answer and resets on replay", () => {
    let game = verdictReducer(initialVerdictGame, { type: "start", rounds: [sample, sample] });
    game = verdictReducer(game, { type: "clue" });
    game = verdictReducer(game, { type: "answer", choice: "pathogenic" });
    game = verdictReducer(game, { type: "next" });
    expect([game.index, game.cluesShown, game.phase]).toEqual([1, 1, "playing"]);
    expect(verdictReducer(game, { type: "next" })).toBe(game);
    game = verdictReducer(game, { type: "answer", choice: null });
    game = verdictReducer(game, { type: "next" });
    expect(game.phase).toBe("finished");
    expect(game.answers.map((a) => a.points)).toEqual([200, 0]);
    expect(verdictReducer(game, { type: "answer", choice: "pathogenic" })).toBe(game);
    expect(verdictReducer(game, { type: "start", rounds: [sample] })).toEqual(start());
    expect(verdictReducer(initialVerdictGame, { type: "start", rounds: [] })).toBe(initialVerdictGame);
  });

  it("shuffles without losing cases or mutating the curated snapshot", () => {
    const original = structuredClone(snapshot.rounds);
    const shuffled = shuffleVerdicts(snapshot.rounds);
    expect(shuffled).not.toBe(snapshot.rounds);
    expect(shuffled.map((r) => r.id).sort()).toEqual(snapshot.rounds.map((r) => r.id).sort());
    expect(snapshot.rounds).toEqual(original);
  });
});
