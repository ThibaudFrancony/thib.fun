import type { Seat } from "@/games/contracts";
import type { TrouNoirConfig } from "@/games/trou-noir/config";
import { trouNoirActiveSeat } from "@/games/trou-noir/engine";
import type {
  QuizQuestion,
  TrouNoirContent,
  TrouNoirState,
  TrouNoirView,
} from "@/games/trou-noir/types";

type PlayerIdentity = { id: string; pseudo: string };

function seatOf(viewerId: string, participants: readonly [string, string]): Seat {
  const seat = participants.indexOf(viewerId);
  if (seat !== 0 && seat !== 1) throw new Error("NOT_A_PARTICIPANT");
  return seat;
}

function findQuestion(content: TrouNoirContent, itemId: string): QuizQuestion | null {
  return content.questions.find((item) => item.itemId === itemId) ?? null;
}

export function projectTrouNoir(
  stateInput: unknown,
  configInput: unknown,
  content: TrouNoirContent,
  viewerId: string,
  participants: readonly [string, string],
  identities: readonly [PlayerIdentity, PlayerIdentity],
  configParsed?: TrouNoirConfig,
  stateParsed?: TrouNoirState,
): TrouNoirView {
  const state = (stateParsed ?? stateInput) as TrouNoirState;
  const config = (configParsed ?? configInput) as TrouNoirConfig;
  const viewerSeat = seatOf(viewerId, participants);
  const activeSeat = state.phase === "finished" ? state.firstSeat : trouNoirActiveSeat(state);

  const entry = state.schedule[state.round - 1] ?? null;
  const ref = entry ? entry.questions[state.turnInRound] : null;
  const question = ref ? findQuestion(content, ref.itemId) : null;

  const showQuestion = state.phase !== "finished" && question !== null;
  const isAddressee = state.phase !== "finished" && activeSeat === viewerSeat;

  const judging =
    state.phase === "judging" && state.currentAttempt
      ? {
          submitted: true,
          mine: state.currentAttempt.seat === viewerSeat,
        }
      : state.phase === "judging"
        ? { submitted: false, mine: false }
        : null;

  let reveal: TrouNoirView["reveal"] = null;
  if (state.phase === "reveal" && state.currentAttempt && state.pendingVerdict && question) {
    const attempt = state.currentAttempt;
    reveal = {
      attemptId: attempt.id,
      submittedAnswer: attempt.timeout ? "" : attempt.rawAnswer,
      expectedAnswer: question.canonical,
      explanation: question.explanation,
      verdict: state.pendingVerdict,
      impact: state.pendingVerdict === "accept" ? 0 : -10,
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

  const result: TrouNoirView["result"] =
    state.phase === "finished"
      ? {
          outcome: state.finishedOutcome ?? "abandoned",
          winnerId: state.winnerId,
          reason: state.finishedReason ?? "round_limit",
          players: [
            { id: participants[0], score: state.reserves[0] },
            { id: participants[1], score: state.reserves[1] },
          ],
        }
      : null;

  const allowedActions: string[] = [];
  if (state.phase === "answering" && activeSeat === viewerSeat) allowedActions.push("SUBMIT_ANSWER");
  if (reveal?.contestable) allowedActions.push("CONTEST");
  if (
    state.phase === "reveal" &&
    state.contest?.status === "pending" &&
    state.contest.requesterId !== viewerId
  ) {
    allowedActions.push("RESOLVE_CONTEST");
  }
  if (
    state.phase === "reveal" &&
    state.contest?.status !== "pending" &&
    !state.acknowledgedBy.includes(viewerId)
  )
    allowedActions.push("NEXT");
  if (state.phase !== "finished") allowedActions.push("RESIGN", "CLAIM_FORFEIT");

  return {
    kind: "trou-noir",
    stateSchemaVersion: 1,
    phase: state.phase,
    round: state.round,
    maxRounds: config.maxRounds,
    answerSeconds: config.answerSeconds,
    mySeat: viewerSeat,
    activeSeat,
    activePlayerId: state.phase === "finished" ? null : participants[activeSeat],
    question: showQuestion && question && entry
      ? {
          prompt: question.prompt,
          category: entry.category,
          difficulty: entry.difficulty,
          addresseeIsMe: isAddressee,
        }
      : null,
    judging,
    reveal,
    acknowledged: state.acknowledgedBy.includes(viewerId),
    players: [
      {
        id: identities[0].id,
        seat: 0,
        pseudo: identities[0].pseudo,
        reserve: state.reserves[0],
        active: state.phase !== "finished" && activeSeat === 0,
        correct: state.perPlayer[0].correct,
        incorrect: state.perPlayer[0].incorrect,
        timeouts: state.perPlayer[0].timeouts,
      },
      {
        id: identities[1].id,
        seat: 1,
        pseudo: identities[1].pseudo,
        reserve: state.reserves[1],
        active: state.phase !== "finished" && activeSeat === 1,
        correct: state.perPlayer[1].correct,
        incorrect: state.perPlayer[1].incorrect,
        timeouts: state.perPlayer[1].timeouts,
      },
    ],
    result,
    allowedActions,
  };
}

/** Garde-fou de tests : la vue ne doit jamais exposer de solution avant la révélation. */
export function viewLeaksSolution(view: TrouNoirView): boolean {
  if (view.phase === "reveal" || view.phase === "finished") return false;
  return view.reveal !== null;
}

export function serializedViewKeys(view: TrouNoirView): string[] {
  return Object.keys(view).sort();
}
