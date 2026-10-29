import { describe, expect, it } from "vitest";
import type { CodonRound } from "../data";
import { codonOptions, decodeCodon } from "../lib/codons";
import { initialRunnerGame, runnerReducer, type RunnerGame } from "./runner";

const round: CodonRound = { gene: "TEST", transcriptId: "T", chromosome: "1", exon: 1,
  cdsStart: 0, seq: "ATGATGTAACCC", protein: "MM*P", seconds: 2, quizCodons: 3 };
const start = (timed = true, rounds = [round]) => runnerReducer(initialRunnerGame, { type: "start", rounds, timed, now: 0 });
const answer = (game: RunnerGame, now = 10) => runnerReducer(game, {
  type: "answer", amino: decodeCodon(game.rounds[game.index].seq.slice(game.correct * 3, game.correct * 3 + 3))!,
  codonIndex: game.correct, now,
});

describe("Codon Runner game", () => {
  it("scores each codon once, even when consecutive codons encode the same amino acid", () => {
    const first = { type: "answer" as const, amino: "M", codonIndex: 0, now: 10 };
    let game = runnerReducer(start(), first);
    expect([game.correct, game.score]).toEqual([1, 100]);
    expect(runnerReducer(game, first)).toBe(game);
    game = answer(game);
    expect([game.correct, game.score]).toEqual([2, 200]);
    game = answer(game);
    expect([game.phase, game.score]).toEqual(["lab", 300]);
    expect(answer(game)).toBe(game);
  });

  it("penalises a wrong option only once, floors score at zero and permits retry", () => {
    let game = start();
    const wrong = codonOptions("ATG", 0).find((a) => a !== "M")!;
    const action = { type: "answer" as const, amino: wrong, codonIndex: 0, now: 10 };
    game = runnerReducer(game, action);
    expect([game.score, game.mistakes, game.correct]).toEqual([0, 1, 0]);
    expect(runnerReducer(game, action)).toBe(game);
    game = answer(game);
    const nextWrong = codonOptions("ATG", 1).find((a) => a !== "M")!;
    game = runnerReducer(game, { ...action, amino: nextWrong, codonIndex: 1 });
    expect(game.score).toBe(75);
    expect(answer(game).score).toBe(175);
  });

  it("expires by actual event time, including when the timer tick is delayed", () => {
    expect(answer(start(), 2000).phase).toBe("lab");
    expect(answer(start(), 2001).score).toBe(0);
    const expired = runnerReducer(start(), { type: "tick", now: 9999 });
    expect(expired.timedOut).toBe(true);
    expect(answer(expired).score).toBe(0);
    expect(answer(start(), 1999).score).toBe(100);
    expect(answer(start(false), 999999).score).toBe(100);
  });

  it("requires a valid lab deletion, resets the next round and supports replay", () => {
    let game = start(true, [round, round]);
    expect(runnerReducer(game, { type: "next", now: 0 })).toBe(game);
    expect(runnerReducer(game, { type: "delete", position: 0 })).toBe(game);
    game = runnerReducer(game, { type: "tick", now: 3000 });
    expect(runnerReducer(game, { type: "next", now: 3000 })).toBe(game);
    for (const position of [-1, 0.5, 9]) expect(runnerReducer(game, { type: "delete", position })).toBe(game);
    game = runnerReducer(game, { type: "delete", position: 0 });
    game = runnerReducer(game, { type: "delete", position: 3 });
    expect(game.deletion).toBe(3);
    const restored = runnerReducer(game, { type: "delete", position: null });
    expect(runnerReducer(restored, { type: "next", now: 3000 })).toBe(restored);
    game = runnerReducer(game, { type: "next", now: 3000 });
    expect([game.index, game.phase, game.correct, game.deletion, game.deadline]).toEqual([1, "running", 0, null, 5000]);
    game = answer(answer(answer(game, 3010), 3020), 3030);
    game = runnerReducer(game, { type: "delete", position: 0 });
    game = runnerReducer(game, { type: "next", now: 3040 });
    expect([game.phase, game.totalCorrect, game.score]).toEqual(["finished", 3, 300]);
    expect(runnerReducer(game, { type: "tick", now: 999999 })).toBe(game);
    expect(runnerReducer(game, { type: "start", rounds: [round], timed: true, now: 0 })).toEqual(start());
    expect(runnerReducer(initialRunnerGame, { type: "start", rounds: [], timed: true, now: 0 })).toBe(initialRunnerGame);
  });
});
