import {
  COMPATIBILITE_MAX_SKIPS,
  compatibiliteConfigSchema,
} from "@/games/compatibilite/config";
import { compatibiliteStateSchema, type CompatibilityContent, type CompatibiliteView } from "@/games/compatibilite/types";

function sharedScore(matches: number, compared: number): number | null {
  return compared === 0 ? null : Math.round((100 * matches) / compared);
}

export function projectCompatibilite(
  stateInput: unknown,
  configInput: unknown,
  contentInput: CompatibilityContent,
  viewerId: string,
  participants: readonly [string, string],
  identities: readonly [{ id: string; pseudo: string }, { id: string; pseudo: string }],
): CompatibiliteView {
  const state = compatibiliteStateSchema.parse(stateInput);
  const config = compatibiliteConfigSchema.parse(configInput);
  const content = contentInput;
  const mySeat = participants.indexOf(viewerId);
  if (mySeat !== 0 && mySeat !== 1) throw new Error("NOT_A_PARTICIPANT");
  const opponentSeat = (1 - mySeat) as 0 | 1;
  const question = content.questions.find((item) => item.itemId === state.currentQuestionId);
  if (!question) throw new Error("QUESTION_NOT_IN_PACK");

  const isActiveQuestion = state.phase === "answering" || state.phase === "reveal";
  const result = state.phase === "finished"
    ? {
        outcome: state.finishedReason === "normal" ? "cooperative" as const : "abandoned" as const,
        reason: state.finishedReason ?? "absence",
        winnerId: null,
        matches: state.matches,
        compared: state.compared,
        skipped: state.skipped,
        sharedScore: state.finishedReason === "normal" ? sharedScore(state.matches, state.compared) : null,
        rounds: state.rounds,
      }
    : null;

  const allowedActions: string[] = [];
  if (state.phase === "answering") {
    if (!state.submitted[mySeat]) allowedActions.push("SUBMIT_CHOICE");
    if (state.skipped < COMPATIBILITE_MAX_SKIPS && state.reserveIds.length > 0) allowedActions.push("SKIP_QUESTION");
  }
  if (state.phase === "reveal" && !state.acknowledgedBy.includes(viewerId)) allowedActions.push("NEXT");
  if (state.phase !== "finished") {
    allowedActions.push("RESIGN", "CLAIM_FORFEIT");
  }

  return {
    kind: "compatibilite",
    stateSchemaVersion: 1,
    phase: state.phase,
    category: config.category,
    mySeat,
    questionIndex: state.questionIndex,
    questionCount: config.questionCount,
    question: isActiveQuestion
      ? { itemId: question.itemId, prompt: question.prompt, options: question.options }
      : null,
    myChoice: isActiveQuestion ? state.choices[mySeat] : null,
    mySubmitted: state.submitted[mySeat],
    opponentSubmitted: state.submitted[opponentSeat],
    opponentChoice: state.phase === "reveal" ? state.choices[opponentSeat] : null,
    matches: state.matches,
    compared: state.compared,
    skipped: state.skipped,
    skipsRemaining: Math.max(0, Math.min(COMPATIBILITE_MAX_SKIPS - state.skipped, state.reserveIds.length)),
    sharedScore: sharedScore(state.matches, state.compared),
    players: [
      { id: identities[0].id, seat: 0, pseudo: identities[0].pseudo, submitted: state.submitted[0] },
      { id: identities[1].id, seat: 1, pseudo: identities[1].pseudo, submitted: state.submitted[1] },
    ],
    result,
    allowedActions,
  };
}
