import type { Seat } from "@/games/contracts";
import type { TtmcConfig } from "@/games/ttmc/config";
import { ttmcActiveSeat } from "@/games/ttmc/engine";
import type { TtmcContent, TtmcQuestion, TtmcState, TtmcView } from "@/games/ttmc/types";

type PlayerIdentity = { id: string; pseudo: string };

function seatOf(viewerId: string, participants: readonly [string, string]): Seat {
  const seat = participants.indexOf(viewerId);
  if (seat !== 0 && seat !== 1) throw new Error("NOT_A_PARTICIPANT");
  return seat;
}

function findQuestion(content: TtmcContent, itemId: string | null): TtmcQuestion | null {
  if (!itemId) return null;
  return content.questions.find((item) => item.itemId === itemId) ?? null;
}

function averageLevel(answeredCount: number, sum: number): number | null {
  return answeredCount > 0 ? sum / answeredCount : null;
}

export function projectTtmc(
  stateInput: unknown,
  configInput: unknown,
  content: TtmcContent,
  viewerId: string,
  participants: readonly [string, string],
  identities: readonly [PlayerIdentity, PlayerIdentity],
  configParsed?: TtmcConfig,
  stateParsed?: TtmcState,
): TtmcView {
  const state = (stateParsed ?? stateInput) as TtmcState;
  const config = (configParsed ?? configInput) as TtmcConfig;
  const viewerSeat = seatOf(viewerId, participants);
  const activeSeat = state.phase === "finished" ? state.firstSeat : ttmcActiveSeat(state);

  const theme = state.themes[state.round - 1] ?? null;
  const question = findQuestion(content, state.currentQuestionId);

  const showPrompt = (state.phase === "answering" || state.phase === "judging" || state.phase === "reveal") && question !== null;
  const isAddressee = state.phase !== "finished" && activeSeat === viewerSeat;

  const judging =
    state.phase === "judging" && state.currentAttempt
      ? { submitted: true, mine: state.currentAttempt.seat === viewerSeat }
      : state.phase === "judging"
        ? { submitted: false, mine: false }
        : null;

  let reveal: TtmcView["reveal"] = null;
  if (state.phase === "reveal" && state.currentAttempt && state.pendingVerdict && question) {
    const attempt = state.currentAttempt;
    reveal = {
      attemptId: attempt.id,
      submittedAnswer: attempt.timeout ? "" : attempt.rawAnswer,
      expectedAnswer: question.canonical,
      explanation: question.explanation,
      verdict: state.pendingVerdict,
      points: state.pendingVerdict === "accept" ? (state.chosenLevel ?? attempt.level) : 0,
      timeout: attempt.timeout,
      contestable:
        state.pendingVerdict === "reject" &&
        !attempt.timeout &&
        attempt.seat === viewerSeat &&
        state.contest === null &&
        !state.acknowledgedBy.includes(viewerId),
      contest: state.contest
        ? {
            status: state.contest.status,
            accepted: state.contest.accepted,
            requesterIsMe: state.contest.requesterId === viewerId,
            expiresAt: state.contest.expiresAt,
          }
        : null,
    };
  }

  const result: TtmcView["result"] =
    state.phase === "finished"
      ? {
          outcome: state.finishedOutcome ?? "abandoned",
          winnerId: state.winnerId,
          reason: state.finishedReason ?? "round_limit",
          players: [
            { id: participants[0], score: state.scores[0] },
            { id: participants[1], score: state.scores[1] },
          ],
        }
      : null;

  const allowedActions: string[] = [];
  if (state.phase === "choose_level" && activeSeat === viewerSeat) allowedActions.push("CHOOSE_LEVEL");
  if (state.phase === "answering" && activeSeat === viewerSeat) allowedActions.push("SUBMIT_ANSWER");
  if (reveal?.contestable) allowedActions.push("CONTEST");
  if (state.phase === "reveal" && state.contest?.status === "pending" && state.contest.requesterId !== viewerId) {
    allowedActions.push("RESOLVE_CONTEST");
  }
  if (state.phase === "reveal" && state.contest?.status !== "pending" && !state.acknowledgedBy.includes(viewerId)) {
    allowedActions.push("NEXT");
  }
  if (state.phase !== "finished") allowedActions.push("RESIGN", "CLAIM_FORFEIT");

  const lastChanceOfRound =
    state.phase !== "finished" &&
    state.turnInRound === 1 &&
    (state.scores[0] >= config.targetScore || state.scores[1] >= config.targetScore);

  return {
    kind: "ttmc",
    stateSchemaVersion: 1,
    phase: state.phase,
    round: state.round,
    maxRounds: config.maxRounds,
    targetScore: config.targetScore,
    answerSeconds: config.answerSeconds,
    themeSelectionSeconds: config.themeSelectionSeconds,
    mySeat: viewerSeat,
    activeSeat,
    activePlayerId: state.phase === "finished" ? null : participants[activeSeat],
    theme: theme ? { themeId: theme.themeId, label: theme.label, description: theme.description } : null,
    // Niveau confirmé visible des deux côtés ; aucun brouillon exposé.
    chosenLevel: state.phase === "choose_level" ? null : state.chosenLevel,
    lastChanceOfRound,
    technicalReplacement: state.replacementCount > 0,
    // Incident technique : la question affichée est une réserve de même niveau,
    // sans pénalité et sans exposer la file privée.
    question:
      showPrompt && question
        ? { prompt: question.prompt, level: state.chosenLevel ?? question.level, addresseeIsMe: isAddressee }
        : null,
    judging,
    reveal,
    acknowledged: state.acknowledgedBy.includes(viewerId),
    players: [
      {
        id: identities[0].id,
        seat: 0,
        pseudo: identities[0].pseudo,
        score: state.scores[0],
        active: state.phase !== "finished" && activeSeat === 0,
        correct: state.counters[0].correct,
        incorrect: state.counters[0].incorrect,
        timeouts: state.counters[0].timeouts,
        averageLevel: averageLevel(state.counters[0].answeredCount, state.counters[0].chosenLevelSum),
      },
      {
        id: identities[1].id,
        seat: 1,
        pseudo: identities[1].pseudo,
        score: state.scores[1],
        active: state.phase !== "finished" && activeSeat === 1,
        correct: state.counters[1].correct,
        incorrect: state.counters[1].incorrect,
        timeouts: state.counters[1].timeouts,
        averageLevel: averageLevel(state.counters[1].answeredCount, state.counters[1].chosenLevelSum),
      },
    ],
    result,
    allowedActions,
  };
}
