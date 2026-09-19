import type { EngineContext, JobSpec, ResultSpec, RoundRecord, Seat } from "@/games/contracts";
import { DEFAULT_UNO_CONFIG, unoRuntimeConfigSchema, type UnoConfig, type UnoRuntimeConfig } from "@/games/uno/config";
import { buildUnoDeck, cardPoints, isNumericCard, UNO_COLORS } from "@/games/uno/deck";
import {
  type UnoAction,
  type UnoCard,
  type UnoColor,
  type UnoCounters,
  type UnoPendingPenalty,
  type UnoState,
  unoActionSchema,
  unoStateSchema,
} from "@/games/uno/types";

export const UNO_RULES_VERSION = "uno-2";
export const UNO_ENGINE_VERSION = "uno-engine-2";

export class UnoRuleError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "UnoRuleError";
    this.code = code;
  }
}

export type UnoEngineContext = EngineContext<null>;

export type UnoTransition = {
  state: UnoState;
  phaseId: string;
  deadlineAt: string | null;
  deadlineKind: string | null;
  jobs: JobSpec[];
  roundRecords: RoundRecord[];
  result: ResultSpec | null;
  event: { type: string; payload: Record<string, unknown> };
};

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function randomUnit(entropy: readonly number[], index: number): number {
  const value = entropy[index];
  if (value === undefined || !Number.isFinite(value) || value < 0 || value >= 1) throw new UnoRuleError("INVALID_ENTROPY");
  return value;
}

function shuffled<T>(items: readonly T[], entropy: readonly number[], offset = 0): T[] {
  const result = [...items];
  for (let index = result.length - 1, cursor = offset; index > 0; index -= 1, cursor += 1) {
    const swap = Math.floor(randomUnit(entropy, cursor) * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function seatForActor(ctx: UnoEngineContext): Seat {
  const seat = ctx.participants.indexOf(ctx.actorId ?? "");
  if (seat !== 0 && seat !== 1) throw new UnoRuleError("NOT_A_PARTICIPANT");
  return seat;
}

function counters(): UnoCounters {
  return { cardsPlayed: 0, cardsDrawn: 0, penaltyCardsTaken: 0, missedAnnouncements: 0, turns: 0 };
}

function deadlineJob(ctx: UnoEngineContext, phaseId: string, runAt: string): JobSpec {
  return {
    kind: "turn_timeout",
    phaseId,
    runAt,
    dedupeKey: `${ctx.matchId}:${phaseId}:turn_timeout`,
    payload: { matchId: ctx.matchId, phaseId, kind: "turn_timeout" },
  };
}

function transition(
  ctx: UnoEngineContext,
  state: UnoState,
  options: {
    phaseId: string;
    deadlineAt: string | null;
    deadlineKind: string | null;
    jobs?: JobSpec[];
    roundRecords?: RoundRecord[];
    result?: ResultSpec | null;
    eventType: string;
    eventPayload?: Record<string, unknown>;
  },
): UnoTransition {
  return {
    state,
    phaseId: options.phaseId,
    deadlineAt: options.deadlineAt,
    deadlineKind: options.deadlineKind,
    jobs: options.jobs ?? [],
    roundRecords: options.roundRecords ?? [],
    result: options.result ?? null,
    event: { type: options.eventType, payload: options.eventPayload ?? {} },
  };
}

function playDeadlineTransition(ctx: UnoEngineContext, state: UnoState, config: UnoConfig, eventType: string): UnoTransition {
  const deadlineAt = iso(ctx.nowMs + config.turnSeconds * 1000);
  return transition(ctx, state, {
    phaseId: ctx.nextPhaseId,
    deadlineAt,
    deadlineKind: "turn_timeout",
    jobs: [deadlineJob(ctx, ctx.nextPhaseId, deadlineAt)],
    eventType,
  });
}

function sameDeadlineTransition(ctx: UnoEngineContext, state: UnoState, config: UnoConfig, eventType: string): UnoTransition {
  const deadlineAt = ctx.currentDeadlineAt ?? iso(ctx.nowMs + config.turnSeconds * 1000);
  return transition(ctx, state, {
    phaseId: ctx.nextPhaseId,
    deadlineAt,
    deadlineKind: "turn_timeout",
    jobs: [deadlineJob(ctx, ctx.nextPhaseId, deadlineAt)],
    eventType,
  });
}

function hasActiveColor(hand: readonly UnoCard[], activeColor: UnoColor): boolean {
  return hand.some((card) => card.color === activeColor);
}

/** Pénalité en attente normalisée (`null` pour les états `uno-1` sans le champ). */
function pendingOf(state: Pick<UnoState, "pendingPenalty">): UnoPendingPenalty | null {
  return state.pendingPenalty ?? null;
}

export function isUnoCardPlayable(card: UnoCard, state: Pick<UnoState, "activeColor" | "discardPile" | "hands" | "pendingPenalty">, seat?: Seat): boolean {
  const pending = pendingOf(state);
  // En pleine attente, seul le même symbole contre (+2 sur +2, +4 sur +4),
  // quelle que soit la couleur et sans restriction de main pour le +4.
  if (pending) return card.symbol === pending.symbol;
  const top = state.discardPile[state.discardPile.length - 1];
  if (!top) return false;
  if (card.symbol === "wild") return true;
  if (card.symbol === "wild4") {
    const hand = seat === undefined ? [] : state.hands[seat];
    return !hasActiveColor(hand, state.activeColor);
  }
  return card.color === state.activeColor || card.symbol === top.symbol;
}

function refillIfNeeded(
  drawPile: UnoCard[],
  discardPile: UnoCard[],
  entropy: readonly number[],
  cursor: number,
): number {
  if (drawPile.length > 0 || discardPile.length <= 1) return cursor;
  const top = discardPile[discardPile.length - 1];
  const recyclable = discardPile.slice(0, -1);
  drawPile.push(...shuffled(recyclable, entropy, cursor));
  discardPile.splice(0, discardPile.length, top);
  return cursor + Math.max(0, recyclable.length - 1);
}

function drawCards(
  state: UnoState,
  count: number,
  entropy: readonly number[],
  cursor = 0,
): { state: UnoState; cards: UnoCard[] } {
  const drawPile = [...state.drawPile];
  const discardPile = [...state.discardPile];
  const drawn: UnoCard[] = [];
  let entropyCursor = cursor;
  while (drawn.length < count) {
    entropyCursor = refillIfNeeded(drawPile, discardPile, entropy, entropyCursor);
    const card = drawPile.shift();
    if (!card) break;
    drawn.push(card);
  }
  return { state: { ...state, drawPile, discardPile }, cards: drawn };
}

function cardFromHand(state: UnoState, seat: Seat, cardId: string): UnoCard {
  const card = state.hands[seat].find((item) => item.id === cardId);
  if (!card) throw new UnoRuleError("CARD_NOT_IN_HAND");
  return card;
}

function assertChosenColor(card: UnoCard, chosenColor: UnoColor | undefined): void {
  const isWild = card.symbol === "wild" || card.symbol === "wild4";
  if (isWild && !chosenColor) throw new UnoRuleError("WILD_COLOR_REQUIRED");
  if (!isWild && chosenColor) throw new UnoRuleError("CHOSEN_COLOR_NOT_ALLOWED");
}

function removeCard(hand: readonly UnoCard[], cardId: string): UnoCard[] {
  const index = hand.findIndex((card) => card.id === cardId);
  if (index < 0) throw new UnoRuleError("CARD_NOT_IN_HAND");
  return [...hand.slice(0, index), ...hand.slice(index + 1)];
}

function withCounter(
  state: UnoState,
  seat: Seat,
  changes: Partial<UnoCounters>,
): UnoState {
  const nextCounters: [UnoCounters, UnoCounters] = [...state.counters] as [UnoCounters, UnoCounters];
  nextCounters[seat] = { ...nextCounters[seat], ...changes };
  return { ...state, counters: nextCounters };
}

function addDrawCounters(state: UnoState, seat: Seat, count: number, penalty = false): UnoState {
  if (count === 0) return state;
  const current = state.counters[seat];
  return withCounter(state, seat, {
    cardsDrawn: current.cardsDrawn + count,
    penaltyCardsTaken: current.penaltyCardsTaken + (penalty ? count : 0),
  });
}

function metricsFor(state: UnoState, seat: Seat): Record<string, unknown> {
  return {
    ...state.counters[seat],
    remainingCards: state.hands[seat].length,
  };
}

function finalRoundRecord(state: UnoState, ctx: UnoEngineContext, reason: string): RoundRecord {
  return {
    roundNo: 1,
    completedAt: iso(ctx.nowMs),
    summary: {
      reason,
      turns: state.turns,
      activeColor: state.activeColor,
      topCard: state.discardPile[state.discardPile.length - 1],
      remainingCards: [state.hands[0].length, state.hands[1].length],
      handValues: [state.hands[0].reduce((sum, card) => sum + cardPoints(card), 0), state.hands[1].reduce((sum, card) => sum + cardPoints(card), 0)],
    },
  };
}

function resultFor(
  state: UnoState,
  ctx: UnoEngineContext,
  outcome: ResultSpec["outcome"],
  reason: ResultSpec["reason"],
  winnerSeat: Seat | null,
  scoreHands = true,
): ResultSpec {
  const scores: [number, number] = !scoreHands || winnerSeat === null
    ? [0, 0]
    : [winnerSeat === 0 ? state.hands[1].reduce((sum, card) => sum + cardPoints(card), 0) : 0,
       winnerSeat === 1 ? state.hands[0].reduce((sum, card) => sum + cardPoints(card), 0) : 0];
  return {
    kind: "competitive",
    outcome,
    winnerId: winnerSeat === null ? null : ctx.participants[winnerSeat],
    reason,
    sharedScore: null,
    players: [
      { userId: ctx.participants[0], score: scores[0], metrics: metricsFor(state, 0) },
      { userId: ctx.participants[1], score: scores[1], metrics: metricsFor(state, 1) },
    ],
    summary: {
      turns: state.turns,
      remainingCards: [state.hands[0].length, state.hands[1].length],
      drawPileCount: state.drawPile.length,
    },
  };
}

function finishedState(state: UnoState, result: ResultSpec): UnoState {
  return {
    ...state,
    phase: "finished",
    drawnCardId: null,
    pendingPenalty: null,
    finishedOutcome: result.outcome === "win" ? "win" : result.outcome === "draw" ? "draw" : "abandoned",
    finishedReason: result.reason,
    winnerId: result.winnerId,
  };
}

function finishIfTurnLimit(
  state: UnoState,
  ctx: UnoEngineContext,
  reason: "turn_limit" | "blocked",
): UnoTransition {
  const result = resultFor(state, ctx, "draw", reason, null);
  return transition(ctx, finishedState(state, result), {
    phaseId: ctx.nextPhaseId,
    deadlineAt: null,
    deadlineKind: null,
    result,
    roundRecords: [finalRoundRecord(state, ctx, reason)],
    eventType: reason === "turn_limit" ? "TURN_LIMIT_REACHED" : "MATCH_BLOCKED",
  });
}

function completeTurn(
  ctx: UnoEngineContext,
  state: UnoState,
  config: UnoConfig,
  nextSeat: Seat,
  blockedTurns: number,
  eventType: string,
): UnoTransition {
  const turns = state.turns + 1;
  const counters: [UnoCounters, UnoCounters] = [...state.counters] as [UnoCounters, UnoCounters];
  counters[state.activeSeat] = { ...counters[state.activeSeat], turns: counters[state.activeSeat].turns + 1 };
  const next = { ...state, phase: "playing" as const, activeSeat: nextSeat, drawnCardId: null, turns, blockedTurns, counters };
  if (turns >= 300) return finishIfTurnLimit(next, ctx, "turn_limit");
  if (blockedTurns >= 2) return finishIfTurnLimit(next, ctx, "blocked");
  return playDeadlineTransition(ctx, next, config, eventType);
}

function playResult(
  ctx: UnoEngineContext,
  state: UnoState,
  config: UnoConfig,
  actorSeat: Seat,
  card: UnoCard,
  chosenColor: UnoColor | undefined,
): UnoTransition {
  let next: UnoState = {
    ...state,
    hands: [...state.hands] as [UnoCard[], UnoCard[]],
    discardPile: [...state.discardPile, card],
    activeColor: card.color ?? chosenColor!,
    drawnCardId: null,
    blockedTurns: 0,
  };
  const hand = removeCard(state.hands[actorSeat], card.id);
  next.hands[actorSeat] = hand;
  next = withCounter(next, actorSeat, { cardsPlayed: next.counters[actorSeat].cardsPlayed + 1 });

  let nextSeat: Seat = (1 - actorSeat) as Seat;
  let stacked = false;
  if (card.symbol === "skip" || card.symbol === "reverse") {
    nextSeat = actorSeat;
  } else if (card.symbol === "draw2" || card.symbol === "wild4") {
    const step = card.symbol === "draw2" ? 2 : 4;
    if (hand.length === 0) {
      // Victoire immédiate : la pénalité s'applique pour le score, sans riposte possible.
      const penalty = drawCards(next, step, ctx.entropy, 0);
      const opponent = (1 - actorSeat) as Seat;
      next = addDrawCounters({ ...penalty.state, hands: [...penalty.state.hands] as [UnoCard[], UnoCard[]] }, opponent, penalty.cards.length, true);
      next.hands[opponent] = [...next.hands[opponent], ...penalty.cards];
      next = { ...next, pendingPenalty: null };
    } else {
      // Cumul : l'attente grandit et la main passe à l'adversaire (contre ou prise).
      next = { ...next, pendingPenalty: { symbol: card.symbol, count: (pendingOf(state)?.count ?? 0) + step } };
      stacked = true;
    }
  }
  if (next.hands[actorSeat].length === 0) {
    const completedCounters: [UnoCounters, UnoCounters] = [...next.counters] as [UnoCounters, UnoCounters];
    completedCounters[actorSeat] = { ...completedCounters[actorSeat], turns: completedCounters[actorSeat].turns + 1 };
    next = { ...next, counters: completedCounters, turns: next.turns + 1 };
    const result = resultFor(next, ctx, "win", "normal", actorSeat);
    return transition(ctx, finishedState(next, result), {
      phaseId: ctx.nextPhaseId,
      deadlineAt: null,
      deadlineKind: null,
      result,
      roundRecords: [finalRoundRecord(next, ctx, "normal")],
      eventType: "MATCH_FINISHED",
      eventPayload: { actorId: ctx.actorId, cardId: card.id },
    });
  }
  if (stacked) {
    return completeTurn(ctx, next, config, nextSeat, 0, pendingOf(state) ? "PENALTY_STACKED" : "PENALTY_STARTED");
  }
  return completeTurn(ctx, next, config, nextSeat, 0, "CARD_PLAYED");
}

function playCard(
  ctx: UnoEngineContext,
  state: UnoState,
  config: UnoConfig,
  actorSeat: Seat,
  card: UnoCard,
  chosenColor: UnoColor | undefined,
): UnoTransition {
  const pending = pendingOf(state);
  if (pending) {
    // En pleine attente, seule la carte du même symbole est admise (pas de mélange +2/+4).
    if (card.symbol !== pending.symbol) throw new UnoRuleError("CARD_NOT_PLAYABLE");
    assertChosenColor(card, chosenColor);
    return playResult(ctx, state, config, actorSeat, card, chosenColor);
  }
  if (!isUnoCardPlayable(card, state, actorSeat)) {
    if (card.symbol === "wild4") throw new UnoRuleError("WILD4_NOT_ALLOWED");
    throw new UnoRuleError("CARD_NOT_PLAYABLE");
  }
  assertChosenColor(card, chosenColor);
  return playResult(ctx, state, config, actorSeat, card, chosenColor);
}

function drawForTurn(ctx: UnoEngineContext, state: UnoState, config: UnoConfig, eventType: string): UnoTransition {
  const actorSeat = state.activeSeat;
  const pending = pendingOf(state);
  if (pending) {
    // Prendre le cumul : pioche tout, l'attente s'annule et l'auteur rejoue.
    const taken = drawCards(state, pending.count, ctx.entropy, 0);
    let next = taken.state;
    next = addDrawCounters({ ...next, hands: [...next.hands] as [UnoCard[], UnoCard[]] }, actorSeat, taken.cards.length, true);
    next.hands[actorSeat] = [...next.hands[actorSeat], ...taken.cards];
    next = { ...next, pendingPenalty: null };
    return completeTurn(ctx, next, config, (1 - actorSeat) as Seat, 0, "PENALTY_APPLIED");
  }
  const drawn = drawCards(state, 1, ctx.entropy, 0);
  let next = drawn.state;
  next = addDrawCounters({ ...next, hands: [...next.hands] as [UnoCard[], UnoCard[]] }, actorSeat, drawn.cards.length);
  const card = drawn.cards[0];
  if (!card) {
    return completeTurn(ctx, next, config, (1 - actorSeat) as Seat, state.blockedTurns + 1, "DRAW_UNAVAILABLE");
  }
  next.hands[actorSeat] = [...next.hands[actorSeat], card];
  if (!isUnoCardPlayable(card, next, actorSeat)) {
    return completeTurn(ctx, next, config, (1 - actorSeat) as Seat, 0, eventType);
  }
  return sameDeadlineTransition(ctx, { ...next, phase: "after_draw", drawnCardId: card.id }, config, "CARD_DRAWN");
}

function abandonTransition(ctx: UnoEngineContext, state: UnoState, actorSeat: Seat, reason: "resign" | "claimed_forfeit" | "absence"): UnoTransition {
  const beforeFirstTurn = state.turns === 0;
  const outcome: ResultSpec["outcome"] = reason === "absence" || beforeFirstTurn ? "abandoned" : "win";
  const winnerSeat = outcome === "win" ? reason === "claimed_forfeit" ? actorSeat : (1 - actorSeat) as Seat : null;
  const result = resultFor(state, ctx, outcome, reason, winnerSeat, false);
  return transition(ctx, finishedState(state, result), {
    phaseId: ctx.nextPhaseId,
    deadlineAt: null,
    deadlineKind: null,
    result,
    roundRecords: [finalRoundRecord(state, ctx, reason)],
    eventType: reason === "resign" ? "PLAYER_RESIGNED" : reason === "claimed_forfeit" ? "FORFEIT_CLAIMED" : "MATCH_ABANDONED",
    eventPayload: { actorId: ctx.actorId, reason },
  });
}

function initialState(config: UnoRuntimeConfig, ctx: UnoEngineContext): UnoState {
  const deck = shuffled(buildUnoDeck(ctx.matchId), ctx.entropy, 1);
  const hands: [UnoCard[], UnoCard[]] = [[], []];
  let cursor = 0;
  for (let round = 0; round < 7; round += 1) {
    const first = deck[cursor++];
    const second = deck[cursor++];
    if (!first || !second) throw new UnoRuleError("DECK_TOO_SMALL");
    hands[0].push(first);
    hands[1].push(second);
  }
  const drawPile = deck.slice(cursor);
  const held: UnoCard[] = [];
  let top: UnoCard | undefined;
  while (drawPile.length > 0) {
    const card = drawPile.shift()!;
    if (isNumericCard(card)) {
      top = card;
      break;
    }
    held.push(card);
  }
  if (!top || top.color === null) throw new UnoRuleError("NO_NUMERIC_START_CARD");
  drawPile.push(...shuffled(held, ctx.entropy, 0));
  return {
    schemaVersion: 1,
    phase: "playing",
    activeSeat: config.firstSeat ?? (Math.floor(randomUnit(ctx.entropy, 0) * 2) as Seat),
    hands,
    drawPile,
    discardPile: [top],
    activeColor: top.color,
    drawnCardId: null,
    pendingPenalty: null,
    turns: 0,
    blockedTurns: 0,
    counters: [counters(), counters()],
    finishedOutcome: null,
    finishedReason: null,
    winnerId: null,
  };
}

export function initializeUno(configInput: unknown, ctx: UnoEngineContext): UnoTransition {
  const config = unoRuntimeConfigSchema.parse(configInput);
  const state = initialState(config, ctx);
  return playDeadlineTransition({ ...ctx, nextPhaseId: ctx.phaseId }, state, config, "MATCH_STARTED");
}

export function reduceUno(stateInput: unknown, actionInput: UnoAction, configInput: unknown, ctx: UnoEngineContext): UnoTransition {
  const state = unoStateSchema.parse(stateInput);
  const action = unoActionSchema.parse(actionInput);
  const config = unoRuntimeConfigSchema.parse(configInput);
  if (state.phase === "finished") throw new UnoRuleError("MATCH_FINISHED");
  const actorSeat = seatForActor(ctx);

  switch (action.type) {
    case "PLAY_CARD": {
      if (state.phase !== "playing") throw new UnoRuleError("NOT_PLAYING");
      if (state.activeSeat !== actorSeat) throw new UnoRuleError("NOT_YOUR_TURN");
      return playCard(ctx, state, config, actorSeat, cardFromHand(state, actorSeat, action.cardId), action.chosenColor);
    }
    case "DRAW": {
      if (state.phase !== "playing") throw new UnoRuleError("NOT_PLAYING");
      if (state.activeSeat !== actorSeat) throw new UnoRuleError("NOT_YOUR_TURN");
      return drawForTurn(ctx, state, config, "DRAWN_AND_PASSED");
    }
    case "PLAY_DRAWN": {
      if (state.phase !== "after_draw") throw new UnoRuleError("NOT_AFTER_DRAW");
      if (state.activeSeat !== actorSeat || !state.drawnCardId) throw new UnoRuleError("NOT_YOUR_TURN");
      const card = cardFromHand(state, actorSeat, state.drawnCardId);
      return playCard(ctx, state, config, actorSeat, card, action.chosenColor);
    }
    case "KEEP_DRAWN": {
      if (state.phase !== "after_draw") throw new UnoRuleError("NOT_AFTER_DRAW");
      if (state.activeSeat !== actorSeat || !state.drawnCardId) throw new UnoRuleError("NOT_YOUR_TURN");
      return completeTurn(ctx, state, config, (1 - actorSeat) as Seat, 0, "DRAW_KEPT");
    }
    case "RESIGN":
      return abandonTransition(ctx, state, actorSeat, "resign");
  }
}

export function onUnoDeadline(stateInput: unknown, kind: string, configInput: unknown, ctx: UnoEngineContext): UnoTransition {
  const state = unoStateSchema.parse(stateInput);
  const config = unoRuntimeConfigSchema.parse(configInput);
  if (state.phase === "finished") throw new UnoRuleError("MATCH_FINISHED");
  if (kind !== "turn_timeout") throw new UnoRuleError("STALE_DEADLINE");
  if (state.phase === "after_draw") {
    return completeTurn(ctx, state, config, (1 - state.activeSeat) as Seat, 0, "DRAW_TIMEOUT_KEPT");
  }
  if (state.phase === "playing") {
    const pending = pendingOf(state);
    if (pending) {
      // Timeout face à une attente : le joueur prend tout le cumul, l'auteur rejoue.
      const taken = drawCards(state, pending.count, ctx.entropy, 0);
      const next = addDrawCounters({ ...taken.state, hands: [...taken.state.hands] as [UnoCard[], UnoCard[]] }, state.activeSeat, taken.cards.length, true);
      if (taken.cards.length > 0) next.hands[state.activeSeat] = [...next.hands[state.activeSeat], ...taken.cards];
      return completeTurn(ctx, { ...next, pendingPenalty: null }, config, (1 - state.activeSeat) as Seat, 0, "PENALTY_TIMEOUT");
    }
    const drawn = drawCards(state, 1, ctx.entropy, 0);
    const next = addDrawCounters({ ...drawn.state, hands: [...drawn.state.hands] as [UnoCard[], UnoCard[]] }, state.activeSeat, drawn.cards.length);
    if (drawn.cards[0]) next.hands[state.activeSeat] = [...next.hands[state.activeSeat], drawn.cards[0]];
    return completeTurn(ctx, next, config, (1 - state.activeSeat) as Seat, drawn.cards.length === 0 ? state.blockedTurns + 1 : 0, "TIMEOUT_DRAWN");
  }
  throw new UnoRuleError("STALE_DEADLINE");
}

export function onUnoAbsence(stateInput: unknown, configInput: unknown, ctx: UnoEngineContext): UnoTransition {
  const state = unoStateSchema.parse(stateInput);
  unoRuntimeConfigSchema.parse(configInput);
  if (state.phase === "finished") throw new UnoRuleError("MATCH_FINISHED");
  const leaverSeat = ctx.actorId ? seatForActor(ctx) : null;
  const winnerSeat = leaverSeat === null ? null : ((1 - leaverSeat) as Seat);
  const outcome: ResultSpec["outcome"] = winnerSeat === null ? "abandoned" : "win";
  const result = resultFor(state, ctx, outcome, "absence", winnerSeat, false);
  return transition(ctx, finishedState(state, result), {
    phaseId: ctx.nextPhaseId,
    deadlineAt: null,
    deadlineKind: null,
    result,
    roundRecords: [finalRoundRecord(state, ctx, "absence")],
    eventType: "MATCH_ABANDONED",
    eventPayload: { actorId: ctx.actorId, reason: "absence" },
  });
}

export function shouldAbandonForUnoAbsence(lastSeenAt: readonly [string, string], nowMs: number): boolean {
  const ages = lastSeenAt.map((value) => nowMs - Date.parse(value));
  return ages.some((age) => age >= 30_000);
}

export function unoDeckCardCount(stateInput: unknown): number {
  const state = unoStateSchema.parse(stateInput);
  return state.hands[0].length + state.hands[1].length + state.drawPile.length + state.discardPile.length;
}

export function unoCardValue(card: UnoCard): number {
  return cardPoints(card);
}

export { DEFAULT_UNO_CONFIG, UNO_COLORS };
