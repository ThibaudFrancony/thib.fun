import type { EngineContext, JobSpec, ResultSpec, RoundRecord, Seat } from "@/games/contracts";
import {
  SKYJO_FULL_SCORE_THRESHOLD,
  SKYJO_REVEAL_SECONDS,
  SKYJO_SETUP_SECONDS,
  skyjoMaxRoundsFor,
  skyjoConfigSchema,
  skyjoRuntimeConfigSchema,
  type SkyjoConfig,
} from "@/games/skyjo/config";
import {
  skyjoActionSchema,
  skyjoStateSchema,
  type SkyjoAction,
  type SkyjoCard,
  type SkyjoCell,
  type SkyjoCounters,
  type SkyjoState,
} from "@/games/skyjo/types";

export const SKYJO_RULES_VERSION = "skyjo-1";
export const SKYJO_ENGINE_VERSION = "skyjo-engine-1";

export type SkyjoEngineContext = EngineContext<null>;

export type SkyjoTransition = {
  state: SkyjoState;
  phaseId: string;
  deadlineAt: string | null;
  deadlineKind: string | null;
  jobs: JobSpec[];
  roundRecords: RoundRecord[];
  result: ResultSpec | null;
  event: { type: string; payload: Record<string, unknown> };
};

export class SkyjoRuleError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "SkyjoRuleError";
    this.code = code;
  }
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function seatForActor(ctx: SkyjoEngineContext): Seat {
  const seat = ctx.participants.indexOf(ctx.actorId ?? "");
  if (seat !== 0 && seat !== 1) throw new SkyjoRuleError("NOT_A_PARTICIPANT");
  return seat;
}

function randomUnit(entropy: readonly number[], index: number): number {
  const value = entropy[index];
  if (value === undefined || !Number.isFinite(value) || value < 0 || value >= 1) throw new SkyjoRuleError("INVALID_ENTROPY");
  return value;
}

function shuffled<T>(items: readonly T[], entropy: readonly number[], offset = 0): T[] {
  const result = [...items];
  for (let index = result.length - 1, cursor = offset; index > 0; index -= 1, cursor += 1) {
    const swap = Math.floor(randomUnit(entropy, cursor) * (index + 1));
    const item = result[index];
    result[index] = result[swap];
    result[swap] = item;
  }
  return result;
}

function deadlineJob(ctx: SkyjoEngineContext, kind: string, phaseId: string, runAt: string): JobSpec {
  return {
    kind,
    phaseId,
    runAt,
    dedupeKey: `${ctx.matchId}:${phaseId}:${kind}`,
    payload: { matchId: ctx.matchId, phaseId, kind },
  };
}

function transition(
  ctx: SkyjoEngineContext,
  state: SkyjoState,
  options: {
    phaseId?: string;
    deadlineAt: string | null;
    deadlineKind: string | null;
    jobs?: JobSpec[];
    roundRecords?: RoundRecord[];
    result?: ResultSpec | null;
    eventType: string;
    eventPayload?: Record<string, unknown>;
  },
): SkyjoTransition {
  return {
    state,
    phaseId: options.phaseId ?? ctx.phaseId,
    deadlineAt: options.deadlineAt,
    deadlineKind: options.deadlineKind,
    jobs: options.jobs ?? [],
    roundRecords: options.roundRecords ?? [],
    result: options.result ?? null,
    event: { type: options.eventType, payload: options.eventPayload ?? {} },
  };
}

function setupTransition(ctx: SkyjoEngineContext, state: SkyjoState, eventType: string, phaseId?: string): SkyjoTransition {
  const deadlineAt = iso(ctx.nowMs + SKYJO_SETUP_SECONDS * 1000);
  const pid = phaseId ?? ctx.nextPhaseId;
  return transition(ctx, state, {
    phaseId: pid,
    deadlineAt,
    deadlineKind: "preparation_timeout",
    jobs: [deadlineJob(ctx, "preparation_timeout", pid, deadlineAt)],
    eventType,
  });
}

function turnTransition(ctx: SkyjoEngineContext, state: SkyjoState, config: SkyjoConfig, eventType: string, phaseId?: string): SkyjoTransition {
  const deadlineAt = iso(ctx.nowMs + config.turnSeconds * 1000);
  const pid = phaseId ?? ctx.nextPhaseId;
  return transition(ctx, state, {
    phaseId: pid,
    deadlineAt,
    deadlineKind: "turn_timeout",
    jobs: [deadlineJob(ctx, "turn_timeout", pid, deadlineAt)],
    eventType,
  });
}

function sameBudgetTransition(
  ctx: SkyjoEngineContext,
  state: SkyjoState,
  config: SkyjoConfig,
  eventType: string,
  eventPayload?: Record<string, unknown>,
): SkyjoTransition {
  const deadlineAt = ctx.currentDeadlineAt ?? iso(ctx.nowMs + config.turnSeconds * 1000);
  const pid = ctx.nextPhaseId;
  return transition(ctx, state, {
    phaseId: pid,
    deadlineAt,
    deadlineKind: "turn_timeout",
    jobs: [deadlineJob(ctx, "turn_timeout", pid, deadlineAt)],
    eventType,
    eventPayload,
  });
}

export function buildSkyjoDeck(matchId: string, round: number): SkyjoCard[] {
  const cards: SkyjoCard[] = [];
  const add = (value: number, count: number): void => {
    for (let index = 0; index < count; index += 1) {
      cards.push({ id: `${matchId}:skyjo:r${round}:${String(cards.length).padStart(3, "0")}`, value });
    }
  };
  add(-2, 5);
  add(0, 15);
  add(-1, 10);
  for (let value = 1; value <= 12; value += 1) add(value, 10);
  return cards;
}

export function skyjoDeckSize(): number {
  return 150;
}

function emptyCounters(): SkyjoCounters {
  return {
    rawPointsSum: [0, 0],
    penalties: [0, 0],
    columnClears: [0, 0],
    automaticTurns: [0, 0],
  };
}

function dealRound(matchId: string, round: number, firstSeat: Seat, entropy: readonly number[]): Pick<SkyjoState, "grids" | "drawPile" | "discardPile"> {
  const deck = shuffled(buildSkyjoDeck(matchId, round), entropy, 1);
  const first = deck.slice(0, 12).map((card) => ({ card, revealed: false }) as SkyjoCell);
  const second = deck.slice(12, 24).map((card) => ({ card, revealed: false }) as SkyjoCell);
  const top = deck[24];
  if (!top) throw new SkyjoRuleError("DECK_TOO_SMALL");
  void firstSeat;
  return {
    grids: [first, second] as [SkyjoCell[], SkyjoCell[]],
    drawPile: deck.slice(25),
    discardPile: [top],
  };
}

function lowestHiddenSlot(grid: readonly SkyjoCell[]): number | null {
  for (let slot = 0; slot < grid.length; slot += 1) {
    const cell = grid[slot];
    if (cell && !cell.revealed) return slot;
  }
  return null;
}

function lowestPresentSlot(grid: readonly SkyjoCell[]): number | null {
  for (let slot = 0; slot < grid.length; slot += 1) {
    if (grid[slot]) return slot;
  }
  return null;
}

function allPresentRevealed(grid: readonly SkyjoCell[]): boolean {
  return grid.every((cell) => cell === null || cell.revealed);
}

function sumPresent(grid: readonly SkyjoCell[]): number {
  return grid.reduce((sum, cell) => (cell ? sum + cell.card.value : sum), 0);
}

function clearColumnsForSeat(
  grids: [SkyjoCell[], SkyjoCell[]],
  removed: SkyjoCard[],
  seat: Seat,
): { grids: [SkyjoCell[], SkyjoCell[]]; removed: SkyjoCard[]; clears: number } {
  const nextGrids: [SkyjoCell[], SkyjoCell[]] = [[...grids[0]], [...grids[1]]];
  const nextRemoved = [...removed];
  let clears = 0;
  for (let col = 0; col < 4; col += 1) {
    const slots = [col, col + 4, col + 8];
    const cells = slots.map((slot) => nextGrids[seat][slot]);
    if (cells.some((cell) => cell === null || cell === undefined)) continue;
    const revealed = cells as Exclude<SkyjoCell, null>[];
    if (!revealed.every((cell) => cell.revealed)) continue;
    const value = revealed[0].card.value;
    if (!revealed.every((cell) => cell.card.value === value)) continue;
    for (const slot of slots) {
      const cell = nextGrids[seat][slot];
      if (cell) nextRemoved.push(cell.card);
      nextGrids[seat][slot] = null;
    }
    clears += 1;
  }
  return { grids: nextGrids, removed: nextRemoved, clears };
}

function withCounter(state: SkyjoState, seat: Seat, key: keyof SkyjoCounters, delta: number): SkyjoState {
  const counters: SkyjoCounters = {
    rawPointsSum: [...state.counters.rawPointsSum] as [number, number],
    penalties: [...state.counters.penalties] as [number, number],
    columnClears: [...state.counters.columnClears] as [number, number],
    automaticTurns: [...state.counters.automaticTurns] as [number, number],
  };
  counters[key][seat] += delta;
  return { ...state, counters };
}

function recycleDraw(state: SkyjoState, entropy: readonly number[]): SkyjoState | null {
  if (state.drawPile.length > 0) return state;
  if (state.discardPile.length <= 1) return null;
  const top = state.discardPile[state.discardPile.length - 1];
  const recyclable = state.discardPile.slice(0, -1);
  return {
    ...state,
    drawPile: shuffled(recyclable, entropy, 0),
    discardPile: [top],
  };
}

function metricsFor(state: SkyjoState, seat: Seat, completedRounds: number): Record<string, unknown> {
  return {
    roundsPlayed: completedRounds,
    rawPointsSum: state.counters.rawPointsSum[seat],
    penalties: state.counters.penalties[seat],
    columnClears: state.counters.columnClears[seat],
    automaticTurns: state.counters.automaticTurns[seat],
  };
}

function resultFor(
  state: SkyjoState,
  ctx: SkyjoEngineContext,
  reason: ResultSpec["reason"],
  outcomeOverride?: ResultSpec["outcome"],
  winnerSeatOverride?: Seat | null,
): ResultSpec {
  const [first, second] = state.cumulative;
  const outcome = outcomeOverride ?? (first === second ? "draw" : "win");
  const winnerSeat =
    winnerSeatOverride !== undefined
      ? winnerSeatOverride
      : outcome === "win"
        ? ((first < second ? 0 : 1) as Seat)
        : null;
  const completedRounds = outcomeOverride === undefined || reason === "normal" || reason === "round_limit" ? state.round : Math.max(0, state.round - 1);
  return {
    kind: "competitive",
    outcome,
    winnerId: winnerSeat === null ? null : ctx.participants[winnerSeat],
    reason,
    sharedScore: null,
    players: [
      { userId: ctx.participants[0], score: first, metrics: metricsFor(state, 0, completedRounds) },
      { userId: ctx.participants[1], score: second, metrics: metricsFor(state, 1, completedRounds) },
    ],
    summary: {
      cumulative: state.cumulative,
      rounds: state.round,
    },
  };
}

function finishedState(state: SkyjoState, result: ResultSpec): SkyjoState {
  return {
    ...state,
    phase: "finished",
    heldCard: null,
    heldSource: null,
    acknowledgedBy: [],
    finishedOutcome: result.outcome === "win" ? "win" : result.outcome === "draw" ? "draw" : "abandoned",
    finishedReason: result.reason,
    winnerId: result.winnerId,
  };
}

function finalGridValues(grids: [SkyjoCell[], SkyjoCell[]]): [(number | null)[], (number | null)[]] {
  const values = (grid: SkyjoCell[]): (number | null)[] => grid.map((cell) => (cell ? cell.card.value : null));
  return [values(grids[0]), values(grids[1])];
}

function isMatchOver(config: SkyjoConfig, round: number, cumulative: [number, number]): boolean {
  if (config.format === "full" && (cumulative[0] >= SKYJO_FULL_SCORE_THRESHOLD || cumulative[1] >= SKYJO_FULL_SCORE_THRESHOLD)) return true;
  return round >= skyjoMaxRoundsFor(config);
}

function finishRound(
  ctx: SkyjoEngineContext,
  state: SkyjoState,
  config: SkyjoConfig,
  options: { triggerSeat: Seat | null; penalize: boolean },
): SkyjoTransition {
  let grids: [SkyjoCell[], SkyjoCell[]] = [[...state.grids[0]], [...state.grids[1]]];
  let removed = [...state.removed];
  let clears = 0;
  const clearsBySeat: [number, number] = [0, 0];
  for (const seat of [0, 1] as const) {
    const revealed: [SkyjoCell[], SkyjoCell[]] = [grids[0].map((cell) => (cell ? { ...cell, revealed: true } : null)), grids[1].map((cell) => (cell ? { ...cell, revealed: true } : null))];
    grids = revealed;
    const cleared = clearColumnsForSeat(grids, removed, seat);
    grids = cleared.grids;
    removed = cleared.removed;
    clears += cleared.clears;
    clearsBySeat[seat] += cleared.clears;
  }
  const raw: [number, number] = [sumPresent(grids[0]), sumPresent(grids[1])];
  let finalScores: [number, number] = [...raw];
  let penalizedSeat: Seat | null = null;
  if (options.penalize && options.triggerSeat !== null) {
    const trigger = options.triggerSeat;
    const other = (1 - trigger) as Seat;
    if (raw[trigger] > 0 && !(raw[trigger] < raw[other])) {
      finalScores = [...raw] as [number, number];
      finalScores[trigger] = raw[trigger] * 2;
      penalizedSeat = trigger;
    }
  }
  const cumulative: [number, number] = [state.cumulative[0] + finalScores[0], state.cumulative[1] + finalScores[1]];
  let next: SkyjoState = {
    ...state,
    grids,
    removed,
    heldCard: null,
    heldSource: null,
    closingSeat: state.closingSeat,
    finalTurnsRemaining: 0,
    cumulative,
    roundSummary: {
      round: state.round,
      triggerSeat: options.triggerSeat,
      raw,
      final: finalScores,
      penalizedSeat,
      clears,
      turns: state.turns,
      cumulativeAfter: cumulative,
    },
    counters: {
      rawPointsSum: [state.counters.rawPointsSum[0] + raw[0], state.counters.rawPointsSum[1] + raw[1]],
      penalties: penalizedSeat === null ? [...state.counters.penalties] as [number, number] : (penalizedSeat === 0 ? [state.counters.penalties[0] + 1, state.counters.penalties[1]] : [state.counters.penalties[0], state.counters.penalties[1]]),
      columnClears: [state.counters.columnClears[0] + clearsBySeat[0], state.counters.columnClears[1] + clearsBySeat[1]] as [number, number],
      automaticTurns: [...state.counters.automaticTurns] as [number, number],
    },
  };
  const roundRecord: RoundRecord = {
    roundNo: state.round,
    completedAt: iso(ctx.nowMs),
    summary: {
      round: state.round,
      triggerSeat: options.triggerSeat,
      raw,
      final: finalScores,
      penalizedSeat,
      clears,
      turns: state.turns,
      cumulativeAfter: cumulative,
      finalGrids: finalGridValues(grids),
    },
  };
  if (isMatchOver(config, state.round, cumulative)) {
    const result = resultFor(next, ctx, state.round >= skyjoMaxRoundsFor(config) && !(config.format === "full" && (cumulative[0] >= SKYJO_FULL_SCORE_THRESHOLD || cumulative[1] >= SKYJO_FULL_SCORE_THRESHOLD)) ? "round_limit" : "normal");
    return transition(ctx, finishedState(next, result), {
      phaseId: ctx.nextPhaseId,
      deadlineAt: null,
      deadlineKind: null,
      roundRecords: [roundRecord],
      result,
      eventType: "MATCH_FINISHED",
      eventPayload: { round: state.round },
    });
  }
  next = { ...next, phase: "round_reveal", acknowledgedBy: [] };
  const revealAt = iso(ctx.nowMs + SKYJO_REVEAL_SECONDS * 1000);
  return transition(ctx, next, {
    phaseId: ctx.nextPhaseId,
    deadlineAt: revealAt,
    deadlineKind: "advance_reveal",
    jobs: [deadlineJob(ctx, "advance_reveal", ctx.nextPhaseId, revealAt)],
    roundRecords: [roundRecord],
    eventType: "ROUND_COMPLETED",
    eventPayload: { round: state.round },
  });
}

function startNextRound(ctx: SkyjoEngineContext, state: SkyjoState, eventType: string): SkyjoTransition {
  const nextRound = state.round + 1;
  const firstSeat = (1 - state.firstSeat) as Seat;
  const dealt = dealRound(ctx.matchId, nextRound, firstSeat, ctx.entropy);
  const next: SkyjoState = {
    ...state,
    phase: "setup",
    round: nextRound,
    activeSeat: firstSeat,
    firstSeat,
    grids: dealt.grids,
    initialReady: [false, false],
    initialSums: [null, null],
    drawPile: dealt.drawPile,
    discardPile: dealt.discardPile,
    removed: [],
    heldCard: null,
    heldSource: null,
    closingSeat: null,
    finalTurnsRemaining: 0,
    turns: 0,
    acknowledgedBy: [],
    roundSummary: null,
  };
  return setupTransition(ctx, next, eventType);
}

function completeTurn(
  ctx: SkyjoEngineContext,
  state: SkyjoState,
  config: SkyjoConfig,
  actorSeat: Seat,
  eventType: string,
  options: { automatic?: boolean } = {},
): SkyjoTransition {
  let next = options.automatic ? withCounter(state, actorSeat, "automaticTurns", 1) : state;
  const cleared = clearColumnsForSeat(next.grids, next.removed, actorSeat);
  if (cleared.clears > 0) {
    const counters = next.counters;
    const columnClears: [number, number] = [...counters.columnClears] as [number, number];
    columnClears[actorSeat] += cleared.clears;
    next = { ...next, grids: cleared.grids, removed: cleared.removed, counters: { ...counters, columnClears } };
  } else {
    next = { ...next, grids: cleared.grids, removed: cleared.removed };
  }
  const turns = next.turns + 1;
  next = { ...next, turns, heldCard: null, heldSource: null };
  if (turns >= 200) {
    return finishRound(ctx, next, config, { triggerSeat: null, penalize: false });
  }
  // Fin déjà déclenchée par l'autre siège : ce tour adverse était l'unique
  // dernier tour, la manche se termine quel que soit l'état de sa grille.
  if (next.closingSeat !== null && actorSeat !== next.closingSeat) {
    return finishRound(ctx, next, config, { triggerSeat: next.closingSeat, penalize: true });
  }
  if (next.closingSeat === null && allPresentRevealed(next.grids[actorSeat])) {
    next = { ...next, closingSeat: actorSeat, finalTurnsRemaining: 1 };
  }
  const nextSeat = (1 - actorSeat) as Seat;
  next = { ...next, phase: "choose_source", activeSeat: nextSeat };
  return turnTransition(ctx, next, config, eventType);
}

function applySetupChoice(
  ctx: SkyjoEngineContext,
  state: SkyjoState,
  config: SkyjoConfig,
  seat: Seat,
  slots: [number, number],
  options: { automatic?: boolean } = {},
): SkyjoTransition {
  if (slots[0] === slots[1]) throw new SkyjoRuleError("INVALID_SLOTS");
  let next = options.automatic ? withCounter(state, seat, "automaticTurns", 1) : state;
  const grids: [SkyjoCell[], SkyjoCell[]] = [[...next.grids[0]], [...next.grids[1]]];
  for (const slot of slots) {
    const cell = grids[seat][slot];
    if (!cell) throw new SkyjoRuleError("SLOT_EMPTY");
    if (cell.revealed) throw new SkyjoRuleError("SLOT_ALREADY_REVEALED");
  }
  let sum = 0;
  for (const slot of slots) {
    const cell = grids[seat][slot];
    if (!cell) throw new SkyjoRuleError("SLOT_EMPTY");
    grids[seat][slot] = { ...cell, revealed: true };
    sum += cell.card.value;
  }
  const initialReady: [boolean, boolean] = [...next.initialReady] as [boolean, boolean];
  initialReady[seat] = true;
  const initialSums = [...next.initialSums] as [number | null, number | null];
  initialSums[seat] = sum;
  next = { ...next, grids, initialReady, initialSums };
  if (initialReady[0] && initialReady[1]) {
    let firstSeat = next.firstSeat;
    if (next.round === 1) {
      const [first, second] = initialSums;
      if ((first ?? 0) !== (second ?? 0)) {
        firstSeat = (first ?? 0) > (second ?? 0) ? 0 : 1;
      } else {
        firstSeat = (randomUnit(ctx.entropy, 0) < 0.5 ? 0 : 1) as Seat;
      }
    }
    next = { ...next, phase: "choose_source", activeSeat: firstSeat, firstSeat };
    return turnTransition(ctx, next, config, "SETUP_COMPLETED");
  }
  return setupTransition(ctx, next, "INITIAL_REVEALED");
}

function pickRandomSlots(count: number, hidden: number[], entropy: readonly number[], offset: number): number[] {
  const pool = [...hidden];
  const picked: number[] = [];
  let cursor = offset;
  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(randomUnit(entropy, cursor) * pool.length);
    cursor += 1;
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

function autoSetup(ctx: SkyjoEngineContext, state: SkyjoState, config: SkyjoConfig): SkyjoTransition {
  let next = state;
  let events = 0;
  for (const seat of [0, 1] as const) {
    if (next.initialReady[seat]) continue;
    const hidden: number[] = [];
    next.grids[seat].forEach((cell, slot) => {
      if (cell && !cell.revealed) hidden.push(slot);
    });
    const picked = pickRandomSlots(2, hidden, ctx.entropy, events * 2);
    if (picked.length < 2) throw new SkyjoRuleError("MATCH_BLOCKED");
    const grids: [SkyjoCell[], SkyjoCell[]] = [[...next.grids[0]], [...next.grids[1]]];
    let sum = 0;
    for (const slot of picked) {
      const cell = grids[seat][slot];
      if (!cell) throw new SkyjoRuleError("MATCH_BLOCKED");
      grids[seat][slot] = { ...cell, revealed: true };
      sum += cell.card.value;
    }
    const initialReady: [boolean, boolean] = [...next.initialReady] as [boolean, boolean];
    initialReady[seat] = true;
    const initialSums = [...next.initialSums] as [number | null, number | null];
    initialSums[seat] = sum;
    next = withCounter({ ...next, grids, initialReady, initialSums }, seat, "automaticTurns", 1);
    events += 1;
  }
  let firstSeat = next.firstSeat;
  if (next.round === 1) {
    const [first, second] = next.initialSums;
    if ((first ?? 0) !== (second ?? 0)) {
      firstSeat = (first ?? 0) > (second ?? 0) ? 0 : 1;
    } else {
      firstSeat = (randomUnit(ctx.entropy, 4) < 0.5 ? 0 : 1) as Seat;
    }
  }
  next = { ...next, phase: "choose_source", activeSeat: firstSeat, firstSeat };
  return turnTransition(ctx, next, config, "SETUP_TIMED_OUT");
}

function autoResolveDrawn(
  ctx: SkyjoEngineContext,
  state: SkyjoState,
  config: SkyjoConfig,
  actorSeat: Seat,
  drawn: SkyjoCard,
): SkyjoTransition {
  const hidden = lowestHiddenSlot(state.grids[actorSeat]);
  if (hidden !== null) {
    const grids: [SkyjoCell[], SkyjoCell[]] = [[...state.grids[0]], [...state.grids[1]]];
    const cell = grids[actorSeat][hidden];
    if (!cell) throw new SkyjoRuleError("MATCH_BLOCKED");
    grids[actorSeat][hidden] = { ...cell, revealed: true };
    const next: SkyjoState = { ...state, grids, discardPile: [...state.discardPile, drawn], heldCard: null, heldSource: null };
    return completeTurn(ctx, next, config, actorSeat, "TURN_TIMED_OUT", { automatic: true });
  }
  const present = lowestPresentSlot(state.grids[actorSeat]);
  if (present === null) throw new SkyjoRuleError("MATCH_BLOCKED");
  const grids: [SkyjoCell[], SkyjoCell[]] = [[...state.grids[0]], [...state.grids[1]]];
  const cell = grids[actorSeat][present];
  if (!cell) throw new SkyjoRuleError("MATCH_BLOCKED");
  grids[actorSeat][present] = { card: drawn, revealed: true };
  const next: SkyjoState = { ...state, grids, discardPile: [...state.discardPile, cell.card], heldCard: null, heldSource: null };
  return completeTurn(ctx, next, config, actorSeat, "TURN_TIMED_OUT", { automatic: true });
}

export function initializeSkyjo(configInput: unknown, ctx: SkyjoEngineContext): SkyjoTransition {
  const config = skyjoRuntimeConfigSchema.parse(configInput);
  const firstSeat = config.firstSeat ?? 0;
  const dealt = dealRound(ctx.matchId, 1, firstSeat, ctx.entropy);
  const state: SkyjoState = {
    schemaVersion: 1,
    phase: "setup",
    round: 1,
    activeSeat: firstSeat,
    firstSeat,
    grids: dealt.grids,
    initialReady: [false, false],
    initialSums: [null, null],
    drawPile: dealt.drawPile,
    discardPile: dealt.discardPile,
    removed: [],
    heldCard: null,
    heldSource: null,
    closingSeat: null,
    finalTurnsRemaining: 0,
    turns: 0,
    cumulative: [0, 0],
    acknowledgedBy: [],
    roundSummary: null,
    counters: emptyCounters(),
    finishedOutcome: null,
    finishedReason: null,
    winnerId: null,
  };
  return setupTransition({ ...ctx, nextPhaseId: ctx.phaseId }, state, "MATCH_STARTED", ctx.phaseId);
}

export function reduceSkyjo(
  stateInput: unknown,
  actionInput: SkyjoAction,
  configInput: unknown,
  ctx: SkyjoEngineContext,
): SkyjoTransition {
  const state = skyjoStateSchema.parse(stateInput);
  const action = skyjoActionSchema.parse(actionInput);
  const config = skyjoConfigSchema.parse(configInput);
  if (state.phase === "finished") throw new SkyjoRuleError("MATCH_FINISHED");
  const actorSeat = seatForActor(ctx);

  switch (action.type) {
    case "REVEAL_INITIAL": {
      if (state.phase !== "setup") throw new SkyjoRuleError("WRONG_PHASE");
      if (state.initialReady[actorSeat]) throw new SkyjoRuleError("ALREADY_SUBMITTED");
      return applySetupChoice(ctx, state, config, actorSeat, action.slots);
    }
    case "TAKE_DRAW": {
      if (state.phase !== "choose_source") throw new SkyjoRuleError("WRONG_PHASE");
      if (state.activeSeat !== actorSeat) throw new SkyjoRuleError("NOT_YOUR_TURN");
      const recycled = recycleDraw(state, ctx.entropy);
      if (!recycled || recycled.drawPile.length === 0) throw new SkyjoRuleError("DRAW_UNAVAILABLE");
      const drawPile = [...recycled.drawPile];
      const drawn = drawPile.shift();
      if (!drawn) throw new SkyjoRuleError("DRAW_UNAVAILABLE");
      const next: SkyjoState = {
        ...recycled,
        drawPile,
        phase: "resolve_draw",
        heldCard: drawn,
        heldSource: "draw",
      };
      return sameBudgetTransition(ctx, next, config, "CARD_DRAWN");
    }
    case "TAKE_DISCARD": {
      if (state.phase !== "choose_source") throw new SkyjoRuleError("WRONG_PHASE");
      if (state.activeSeat !== actorSeat) throw new SkyjoRuleError("NOT_YOUR_TURN");
      if (state.discardPile.length === 0) throw new SkyjoRuleError("MATCH_BLOCKED");
      const discardPile = [...state.discardPile];
      const taken = discardPile.pop();
      if (!taken) throw new SkyjoRuleError("MATCH_BLOCKED");
      const next: SkyjoState = {
        ...state,
        discardPile,
        phase: "replace_discard",
        heldCard: taken,
        heldSource: "discard",
      };
      return sameBudgetTransition(ctx, next, config, "DISCARD_TAKEN");
    }
    case "REPLACE": {
      if (state.phase !== "resolve_draw" && state.phase !== "replace_discard") throw new SkyjoRuleError("WRONG_PHASE");
      if (state.activeSeat !== actorSeat) throw new SkyjoRuleError("NOT_YOUR_TURN");
      if (!state.heldCard) throw new SkyjoRuleError("ILLEGAL_MOVE");
      const cell = state.grids[actorSeat][action.slot];
      if (!cell) throw new SkyjoRuleError("SLOT_EMPTY");
      const grids: [SkyjoCell[], SkyjoCell[]] = [[...state.grids[0]], [...state.grids[1]]];
      grids[actorSeat][action.slot] = { card: state.heldCard, revealed: true };
      const next: SkyjoState = {
        ...state,
        grids,
        discardPile: [...state.discardPile, cell.card],
        heldCard: null,
        heldSource: null,
      };
      return completeTurn(ctx, next, config, actorSeat, "CARD_REPLACED");
    }
    case "DISCARD_AND_REVEAL": {
      if (state.phase !== "resolve_draw") throw new SkyjoRuleError("REPLACE_NOT_ALLOWED");
      if (state.activeSeat !== actorSeat) throw new SkyjoRuleError("NOT_YOUR_TURN");
      if (!state.heldCard || state.heldSource !== "draw") throw new SkyjoRuleError("ILLEGAL_MOVE");
      const cell = state.grids[actorSeat][action.slot];
      if (!cell) throw new SkyjoRuleError("SLOT_EMPTY");
      if (cell.revealed) throw new SkyjoRuleError("SLOT_NOT_HIDDEN");
      const grids: [SkyjoCell[], SkyjoCell[]] = [[...state.grids[0]], [...state.grids[1]]];
      grids[actorSeat][action.slot] = { ...cell, revealed: true };
      const next: SkyjoState = {
        ...state,
        grids,
        discardPile: [...state.discardPile, state.heldCard],
        heldCard: null,
        heldSource: null,
      };
      return completeTurn(ctx, next, config, actorSeat, "DRAWN_DISCARDED");
    }
    case "NEXT": {
      if (state.phase !== "round_reveal") throw new SkyjoRuleError("WRONG_PHASE");
      if (state.acknowledgedBy.includes(ctx.actorId ?? "")) throw new SkyjoRuleError("ALREADY_ACKNOWLEDGED");
      const acknowledgedBy = [...state.acknowledgedBy, ctx.actorId ?? ""];
      const distinct = new Set(acknowledgedBy);
      if (distinct.size < 2) {
        const seats = [...distinct].map((id) => ctx.participants.indexOf(id));
        if (seats.some((seat) => seat !== 0 && seat !== 1)) throw new SkyjoRuleError("NOT_A_PARTICIPANT");
        return transition(ctx, { ...state, acknowledgedBy }, {
          phaseId: ctx.phaseId,
          deadlineAt: ctx.currentDeadlineAt ?? iso(ctx.nowMs + SKYJO_REVEAL_SECONDS * 1000),
          deadlineKind: ctx.currentDeadlineKind ?? "advance_reveal",
          eventType: "REVEAL_ACKNOWLEDGED",
        });
      }
      return startNextRound(ctx, { ...state, acknowledgedBy }, "ROUND_ADVANCED");
    }
    case "RESIGN":
      return abandonTransition(ctx, state, actorSeat, "resign");
    case "CLAIM_FORFEIT":
      return abandonTransition(ctx, state, actorSeat, "claimed_forfeit");
  }
}

function abandonTransition(
  ctx: SkyjoEngineContext,
  state: SkyjoState,
  actorSeat: Seat,
  reason: "resign" | "claimed_forfeit",
): SkyjoTransition {
  const beforeFirstTurn = state.round === 1 && state.turns === 0 && state.closingSeat === null;
  if (beforeFirstTurn) {
    const result = resultFor(state, ctx, reason, "abandoned", null);
    return transition(ctx, finishedState(state, result), {
      phaseId: ctx.nextPhaseId,
      deadlineAt: null,
      deadlineKind: null,
      result,
      eventType: reason === "resign" ? "PLAYER_RESIGNED" : "FORFEIT_CLAIMED",
      eventPayload: { actorId: ctx.actorId },
    });
  }
  const winner = reason === "claimed_forfeit" ? actorSeat : ((1 - actorSeat) as Seat);
  const result = resultFor(state, ctx, reason, "win", winner);
  return transition(ctx, finishedState(state, result), {
    phaseId: ctx.nextPhaseId,
    deadlineAt: null,
    deadlineKind: null,
    result,
    eventType: reason === "resign" ? "PLAYER_RESIGNED" : "FORFEIT_CLAIMED",
    eventPayload: { actorId: ctx.actorId },
  });
}

export function onSkyjoDeadline(
  stateInput: unknown,
  kind: string,
  configInput: unknown,
  ctx: SkyjoEngineContext,
): SkyjoTransition {
  const state = skyjoStateSchema.parse(stateInput);
  const config = skyjoConfigSchema.parse(configInput);
  if (state.phase === "finished") throw new SkyjoRuleError("MATCH_FINISHED");

  if (state.phase === "setup" && (kind === "preparation_timeout" || kind === "turn_timeout")) {
    if (state.initialReady[0] && state.initialReady[1]) throw new SkyjoRuleError("STALE_DEADLINE");
    return autoSetup(ctx, state, config);
  }
  if (state.phase === "choose_source" && kind === "turn_timeout") {
    const seat = state.activeSeat;
    const recycled = recycleDraw(state, ctx.entropy);
    if (!recycled || recycled.drawPile.length === 0) {
      if (state.discardPile.length === 0) throw new SkyjoRuleError("MATCH_BLOCKED");
      const discardPile = [...state.discardPile];
      const taken = discardPile.pop();
      if (!taken) throw new SkyjoRuleError("MATCH_BLOCKED");
      const present = lowestPresentSlot(state.grids[seat]);
      if (present === null) throw new SkyjoRuleError("MATCH_BLOCKED");
      const grids: [SkyjoCell[], SkyjoCell[]] = [[...state.grids[0]], [...state.grids[1]]];
      const cell = grids[seat][present];
      if (!cell) throw new SkyjoRuleError("MATCH_BLOCKED");
      grids[seat][present] = { card: taken, revealed: true };
      const next: SkyjoState = { ...state, grids, discardPile: [...discardPile, cell.card], heldCard: null, heldSource: null };
      return completeTurn(ctx, next, config, seat, "TURN_TIMED_OUT", { automatic: true });
    }
    const drawPile = [...recycled.drawPile];
    const drawn = drawPile.shift();
    if (!drawn) throw new SkyjoRuleError("MATCH_BLOCKED");
    return autoResolveDrawn(ctx, { ...recycled, drawPile }, config, seat, drawn);
  }
  if (state.phase === "resolve_draw" && kind === "turn_timeout") {
    if (!state.heldCard || state.heldSource !== "draw") throw new SkyjoRuleError("STALE_DEADLINE");
    return autoResolveDrawn(ctx, { ...state, heldCard: null, heldSource: null, discardPile: state.discardPile }, config, state.activeSeat, state.heldCard);
  }
  if (state.phase === "replace_discard" && kind === "turn_timeout") {
    if (!state.heldCard) throw new SkyjoRuleError("STALE_DEADLINE");
    const seat = state.activeSeat;
    const present = lowestPresentSlot(state.grids[seat]);
    if (present === null) throw new SkyjoRuleError("MATCH_BLOCKED");
    const grids: [SkyjoCell[], SkyjoCell[]] = [[...state.grids[0]], [...state.grids[1]]];
    const cell = grids[seat][present];
    if (!cell) throw new SkyjoRuleError("MATCH_BLOCKED");
    grids[seat][present] = { card: state.heldCard, revealed: true };
    const next: SkyjoState = { ...state, grids, discardPile: [...state.discardPile, cell.card], heldCard: null, heldSource: null };
    return completeTurn(ctx, next, config, seat, "TURN_TIMED_OUT", { automatic: true });
  }
  if (state.phase === "round_reveal" && kind === "advance_reveal") {
    return startNextRound(ctx, state, "REVEAL_ADVANCED");
  }
  throw new SkyjoRuleError("STALE_DEADLINE");
}

export function shouldAbandonForSkyjoAbsence(lastSeenAt: readonly [string, string], nowMs: number): boolean {
  const ages = lastSeenAt.map((value) => nowMs - Date.parse(value));
  return ages.every((age) => age >= 120_000) || ages.some((age) => age >= 180_000);
}

export function onSkyjoAbsence(stateInput: unknown, configInput: unknown, ctx: SkyjoEngineContext): SkyjoTransition {
  const state = skyjoStateSchema.parse(stateInput);
  skyjoConfigSchema.parse(configInput);
  if (state.phase === "finished") throw new SkyjoRuleError("MATCH_FINISHED");
  const result = resultFor(state, ctx, "absence", "abandoned", null);
  return transition(ctx, finishedState(state, result), {
    phaseId: ctx.nextPhaseId,
    deadlineAt: null,
    deadlineKind: null,
    result,
    eventType: "MATCH_ABANDONED",
    eventPayload: { reason: "absence" },
  });
}

/**
 * Garde anti-rejeu : un job d'échéance créé pour une phase ne doit jamais
 * muter une phase ultérieure, même de même nom (choose_source répété à
 * chaque tour). Les vieux jobs sont déjà annulés au commit, cette garde
 * verrouille le worker avant toute transition.
 */
export function isSkyjoDeadlineJobStale(jobPhaseId: string | null | undefined, currentPhaseId: string): boolean {
  if (!jobPhaseId) return false;
  return jobPhaseId !== currentPhaseId;
}

export function skyjoCardCount(stateInput: unknown): number {
  const state = skyjoStateSchema.parse(stateInput);
  const gridCards = state.grids[0].length + state.grids[1].length;
  void gridCards;
  const countPresent = (grid: readonly SkyjoCell[]): number => grid.filter((cell) => cell !== null).length;
  return (
    countPresent(state.grids[0]) +
    countPresent(state.grids[1]) +
    state.drawPile.length +
    state.discardPile.length +
    state.removed.length +
    (state.heldCard ? 1 : 0)
  );
}
