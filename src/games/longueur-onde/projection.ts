import { longueurOndeConfigSchema } from "@/games/longueur-onde/config";
import { longueurOndeStateSchema, type LongueurOndeContent, type LongueurOndeResultView, type LongueurOndeState, type LongueurOndeView } from "@/games/longueur-onde/types";

function averageError(rounds: LongueurOndeState["rounds"]): number | null {
  const errors = rounds.flatMap((round) => (round.error === null ? [] : [round.error]));
  return errors.length === 0 ? null : Math.round(errors.reduce((sum, error) => sum + error, 0) / errors.length);
}

export function projectLongueurOnde(
  stateInput: unknown,
  configInput: unknown,
  content: LongueurOndeContent,
  viewerId: string,
  participants: readonly [string, string],
  identities: readonly [{ id: string; pseudo: string }, { id: string; pseudo: string }],
): LongueurOndeView {
  const state = longueurOndeStateSchema.parse(stateInput);
  const config = longueurOndeConfigSchema.parse(configInput);
  const mySeat = participants.indexOf(viewerId);
  if (mySeat !== 0 && mySeat !== 1) throw new Error("NOT_A_PARTICIPANT");
  const seat = mySeat as 0 | 1;
  const axis = content.axes.find((candidate) => candidate.itemId === state.axisId);
  if (!axis) throw new Error("AXIS_NOT_IN_PACK");
  const isActive = state.phase !== "finished";
  const isGiver = state.clueSeat === seat;
  const isGuesser = state.clueSeat !== seat;
  const result: LongueurOndeResultView = state.phase === "finished"
    ? {
        outcome: state.finishedReason === "normal" ? "cooperative" : "abandoned",
        reason: state.finishedReason ?? "absence",
        winnerId: null,
        total: state.total,
        maxTotal: config.rounds * 4,
        percentage: state.finishedReason === "normal" ? Math.round((100 * state.total) / (config.rounds * 4)) : null,
        missed: state.missed,
        averageError: averageError(state.rounds),
        rounds: state.rounds.map(({ round, leftLabel, rightLabel, clueSeat, guessSeat, clue, target, guess, error, points, missedReason }) => ({ round, leftLabel, rightLabel, clueSeat, guessSeat, clue, target, guess, error, points, missedReason })),
      }
    : null;
  const allowedActions: string[] = [];
  if (state.phase === "clue" && isGiver) allowedActions.push("SUBMIT_CLUE");
  if (state.phase === "guessing" && isGuesser && state.guess === null) allowedActions.push("SUBMIT_GUESS");
  if (state.phase === "reveal" && !state.acknowledgedBy.includes(viewerId)) allowedActions.push("NEXT");
  if (isActive) allowedActions.push("RESIGN");

  return {
    kind: "longueur-onde",
    stateSchemaVersion: 1,
    phase: state.phase,
    rounds: config.rounds,
    round: state.round,
    clueSeat: state.clueSeat,
    guessSeat: (1 - state.clueSeat) as 0 | 1,
    mySeat: seat,
    isClueGiver: isGiver,
    axis: isActive ? { itemId: axis.itemId, leftLabel: axis.leftLabel, rightLabel: axis.rightLabel, category: axis.category } : null,
    target: state.phase === "reveal" || (isActive && isGiver) ? state.target : null,
    clue: state.clue,
    myGuess: state.phase === "reveal" || (state.phase === "guessing" && isGuesser) ? state.guess : null,
    total: state.total,
    lastPoints: state.lastPoints,
    lastError: state.lastError,
    missed: state.missed,
    players: [
      { id: identities[0].id, seat: 0, pseudo: identities[0].pseudo },
      { id: identities[1].id, seat: 1, pseudo: identities[1].pseudo },
    ],
    result,
    allowedActions,
    config,
  };
}
