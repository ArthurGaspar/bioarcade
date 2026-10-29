import type { CodonRound } from "../data";
import { codonOptions, decodeCodon } from "../lib/codons";

export interface RunnerGame {
  phase: "ready" | "running" | "lab" | "finished";
  rounds: CodonRound[];
  index: number;
  correct: number;
  totalCorrect: number;
  score: number;
  mistakes: number;
  attempts: string[];
  message: string;
  timed: boolean;
  deadline: number;
  now: number;
  deletion: number | null;
  timedOut: boolean;
}

export const initialRunnerGame: RunnerGame = {
  phase: "ready", rounds: [], index: 0, correct: 0, totalCorrect: 0, score: 0,
  mistakes: 0, attempts: [], message: "", timed: true, deadline: 0, now: 0,
  deletion: null, timedOut: false,
};

type Action = { type: "start"; rounds: CodonRound[]; timed: boolean; now: number }
  | { type: "tick"; now: number }
  | { type: "answer"; amino: string; codonIndex: number; now: number }
  | { type: "delete"; position: number | null }
  | { type: "next"; now: number };

export function runnerReducer(state: RunnerGame, action: Action): RunnerGame {
  if (action.type === "start") {
    if (!action.rounds.length) return state;
    return { ...initialRunnerGame, phase: "running", rounds: action.rounds,
      timed: action.timed, now: action.now, deadline: action.now + action.rounds[0].seconds * 1000 };
  }
  if (action.type === "delete") {
    if (state.phase !== "lab") return state;
    if (action.position !== null && (!Number.isInteger(action.position) || action.position < 0 || action.position >= state.rounds[state.index].quizCodons * 3)) return state;
    return { ...state, deletion: action.position };
  }
  if (action.type === "next") {
    if (state.phase !== "lab" || state.deletion === null) return state;
    if (state.index + 1 === state.rounds.length) return { ...state, phase: "finished" };
    return { ...state, phase: "running", index: state.index + 1, correct: 0,
      mistakes: 0, attempts: [], message: "", deletion: null, timedOut: false,
      now: action.now, deadline: action.now + state.rounds[state.index + 1].seconds * 1000 };
  }
  if (state.phase !== "running") return state;
  // Check the actual event time as well as timer ticks. Background tabs can
  // throttle intervals; an answer after the deadline must never earn points.
  if (state.timed && action.now >= state.deadline) {
    return { ...state, phase: "lab", now: action.now, timedOut: true, message: "Time is up. Explore the reading frame below." };
  }
  if (action.type === "tick") return { ...state, now: action.now };
  if (action.codonIndex !== state.correct || state.attempts.includes(action.amino)) return state;
  const round = state.rounds[state.index];
  const codon = round.seq.slice(state.correct * 3, state.correct * 3 + 3);
  if (!codonOptions(codon, state.correct).includes(action.amino)) return state;
  if (decodeCodon(codon) !== action.amino) {
    return { ...state, score: Math.max(0, state.score - 25), mistakes: state.mistakes + 1,
      attempts: [...state.attempts, action.amino], message: "Try another amino acid. −25 points (score never drops below zero).", now: action.now };
  }
  const correct = state.correct + 1;
  return { ...state, correct, totalCorrect: state.totalCorrect + 1, score: state.score + 100,
    attempts: [], message: "Correct! +100 points.", now: action.now,
    phase: correct === round.quizCodons || action.amino === "*" ? "lab" : "running" };
}
