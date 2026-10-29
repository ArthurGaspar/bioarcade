import type { Verdict, VerdictRound } from "../data";

export const verdictLabels: Record<Verdict, string> = {
  pathogenic: "Pathogenic / likely pathogenic",
  benign: "Benign / likely benign",
  uncertain: "Uncertain / conflicting",
};

export interface VerdictAnswer {
  choice: Verdict | null;
  cluesUsed: number;
  points: number;
}

export interface VerdictGame {
  phase: "ready" | "playing" | "revealed" | "finished";
  rounds: VerdictRound[];
  index: number;
  cluesShown: number;
  answers: VerdictAnswer[];
}

export const initialVerdictGame: VerdictGame = {
  phase: "ready", rounds: [], index: 0, cluesShown: 1, answers: [],
};

type Action = { type: "start"; rounds: VerdictRound[] }
  | { type: "clue" } | { type: "answer"; choice: Verdict | null } | { type: "next" };

export const availablePoints = (cluesShown: number) => Math.max(100, 400 - cluesShown * 100);

/** One transition per action prevents repeated clicks from awarding points twice. */
export function verdictReducer(state: VerdictGame, action: Action): VerdictGame {
  if (action.type === "start") {
    if (!action.rounds.length) return state;
    return { ...initialVerdictGame, phase: "playing", rounds: action.rounds };
  }
  if (action.type === "next") {
    if (state.phase !== "revealed") return state;
    return state.index + 1 === state.rounds.length
      ? { ...state, phase: "finished" }
      : { ...state, phase: "playing", index: state.index + 1, cluesShown: 1 };
  }
  if (state.phase !== "playing") return state;
  const round = state.rounds[state.index];
  if (action.type === "clue") {
    return { ...state, cluesShown: Math.min(round.clues.length, state.cluesShown + 1) };
  }
  const points = action.choice === round.verdict ? availablePoints(state.cluesShown) : 0;
  return { ...state, phase: "revealed", answers: [...state.answers, { choice: action.choice, cluesUsed: state.cluesShown, points }] };
}

export function shuffleVerdicts(rounds: VerdictRound[]): VerdictRound[] {
  const deck = [...rounds];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
