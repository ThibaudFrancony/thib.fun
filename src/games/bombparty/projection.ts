import type { Seat } from "@/games/contracts";
import { bombpartyConfigSchema, turnSecondsFor } from "@/games/bombparty/config";
import { bombpartyStateSchema, type BombpartyView } from "@/games/bombparty/types";

type PlayerIdentity = { id: string; pseudo: string };

function seatOf(viewerId: string, participants: readonly [string, string]): Seat {
  const seat = participants.indexOf(viewerId);
  if (seat !== 0 && seat !== 1) throw new Error("NOT_A_PARTICIPANT");
  return seat;
}

/**
 * Projection sans fuite : séquence courante, vies, scores (mots valides),
 * historique des mots déjà acceptés (révélés en jeu), chrono via deadline.
 * Jamais d'index, de lexique, de suggestions ni de mots possibles.
 */
export function projectBombparty(
  stateInput: unknown,
  configInput: unknown,
  viewerId: string,
  participants: readonly [string, string],
  identities: readonly [PlayerIdentity, PlayerIdentity],
): BombpartyView {
  const state = bombpartyStateSchema.parse(stateInput);
  const config = bombpartyConfigSchema.parse(configInput);
  const viewerSeat = seatOf(viewerId, participants);
  const active = state.phase === "playing" && state.activeSeat === viewerSeat;

  const allowedActions: string[] = [];
  if (state.phase === "playing") {
    if (active) allowedActions.push("SUBMIT_WORD");
    allowedActions.push("RESIGN");
  }

  const result: BombpartyView["result"] =
    state.phase === "finished"
      ? {
          outcome: state.finishedOutcome ?? "abandoned",
          winnerId: state.winnerId,
          reason: state.finishedReason ?? "blocked",
          players: [
            { id: participants[0], score: state.correctCounts[0] },
            { id: participants[1], score: state.correctCounts[1] },
          ],
        }
      : null;

  const recentWords = state.acceptedWords.slice(-10);
  const totalResponses = state.responseCount[0] + state.responseCount[1];
  const totalResponseMs = state.sumResponseMs[0] + state.sumResponseMs[1];

  return {
    kind: "bombparty",
    stateSchemaVersion: 1,
    phase: state.phase,
    turn: state.turn,
    maxTurns: 200,
    turnSeconds: turnSecondsFor(state.validWordsTotal, config.initialSeconds),
    initialSeconds: config.initialSeconds,
    sequenceDifficulty: config.sequenceDifficulty,
    mySeat: viewerSeat,
    activeSeat: state.activeSeat,
    activePlayerId: state.phase === "playing" ? participants[state.activeSeat] : null,
    sequence: state.sequence,
    lives: [...state.lives] as [number, number],
    scores: [...state.correctCounts] as [number, number],
    timeouts: [...state.timeoutCounts] as [number, number],
    validWordsTotal: state.validWordsTotal,
    acceptedWords: state.acceptedWords.map((item) => ({ ...item })),
    recentWords: recentWords.map((item) => ({ ...item })),
    longestWordLength: Math.max(state.longestWordLength[0], state.longestWordLength[1]),
    meanAcceptedResponseMs: totalResponses > 0 ? Math.round(totalResponseMs / totalResponses) : null,
    players: [
      { id: identities[0].id, seat: 0, pseudo: identities[0].pseudo, score: state.correctCounts[0], lives: state.lives[0], active: state.phase === "playing" && state.activeSeat === 0 },
      { id: identities[1].id, seat: 1, pseudo: identities[1].pseudo, score: state.correctCounts[1], lives: state.lives[1], active: state.phase === "playing" && state.activeSeat === 1 },
    ],
    result,
    allowedActions,
  };
}
