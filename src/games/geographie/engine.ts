import type { EngineContext, JobSpec, ResultSpec, RoundRecord, Seat } from "@/games/contracts";
import {
  challengeSelectionLength,
  geoConfigSchema,
  geoRuntimeConfigSchema,
  type GeoConfig,
  type GeoRuntimeConfig,
} from "@/games/geographie/config";
import {
  assertValidGeoPoint,
  haversineDistanceKm,
  scoreDistanceKm,
} from "@/games/geographie/scoring";
import type {
  GeoAction,
  GeoCity,
  GeoContent,
  GeoMetrics,
  GeoPlacement,
  GeoState,
} from "@/games/geographie/types";
import { geoStateSchema } from "@/games/geographie/types";

export const GEO_RULES_VERSION = "geographie-1";
export const GEO_ENGINE_VERSION = "geographie-engine-1";

export class GeoRuleError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "GeoRuleError";
    this.code = code;
  }
}

export type GeoEngineContext = EngineContext<GeoContent>;
type GeoFinishReason = NonNullable<GeoState["finishedReason"]>;

export type GeoTransition = {
  state: GeoState;
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

function cityMap(content: GeoContent): Map<string, GeoCity> {
  return new Map(content.cities.map((city) => [city.inseeCode, city]));
}

function seatForActor(ctx: GeoEngineContext): Seat {
  const seat = ctx.participants.indexOf(ctx.actorId ?? "");
  if (seat !== 0 && seat !== 1) throw new GeoRuleError("NOT_A_PARTICIPANT");
  return seat;
}

function activeSeat(state: GeoState): Seat {
  return ((state.firstSeat + state.round - 1 + state.turnInRound) % 2) as Seat;
}

function randomUnit(entropy: readonly number[], index: number): number {
  const value = entropy[index] ?? 0;
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new GeoRuleError("INVALID_ENTROPY");
  }
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

function findCity(content: GeoContent, cityId: string): GeoCity {
  const city = cityMap(content).get(cityId);
  if (!city) throw new GeoRuleError("CITY_NOT_IN_PACK");
  return city;
}

function poolFor(content: GeoContent, config: GeoConfig): GeoCity[] {
  const pool = content.cities.filter((city) => city.difficulty === config.difficulty);
  if (pool.length < config.rounds) throw new GeoRuleError("INSUFFICIENT_CONTENT");
  return pool;
}

function emptyMetrics(): GeoMetrics {
  return { distanceSumKm: 0, validPlacements: 0, missedPlacements: 0, bestDistanceKm: null };
}

function validateSelection(
  cityIds: readonly string[],
  required: number,
  content: GeoContent,
  config: GeoConfig,
): void {
  if (cityIds.length !== required || new Set(cityIds).size !== cityIds.length) {
    throw new GeoRuleError("INVALID_CITY_SELECTION");
  }
  const available = new Map(poolFor(content, config).map((city) => [city.inseeCode, city]));
  if (cityIds.some((id) => !available.has(id))) throw new GeoRuleError("CITY_NOT_IN_POOL");
}

function deadlineJob(
  ctx: GeoEngineContext,
  kind: string,
  phaseId: string,
  runAt: string,
): JobSpec {
  return {
    kind,
    phaseId,
    runAt,
    dedupeKey: `${ctx.matchId}:${phaseId}:${kind}`,
    payload: { matchId: ctx.matchId, phaseId, kind },
  };
}

function transition(
  ctx: GeoEngineContext,
  state: GeoState,
  options: {
    deadlineAt: string | null;
    deadlineKind: string | null;
    jobs?: JobSpec[];
    roundRecords?: RoundRecord[];
    result?: ResultSpec | null;
    eventType: string;
    eventPayload?: Record<string, unknown>;
    phaseId?: string;
  },
): GeoTransition {
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

function placingTransition(ctx: GeoEngineContext, state: GeoState, config: GeoConfig, eventType: string): GeoTransition {
  const deadlineAt = iso(ctx.nowMs + config.turnSeconds * 1000);
  return transition(ctx, state, {
    phaseId: ctx.nextPhaseId,
    deadlineAt,
    deadlineKind: "turn_timeout",
    jobs: [deadlineJob(ctx, "turn_timeout", ctx.nextPhaseId, deadlineAt)],
    eventType,
  });
}

function resultFor(
  state: GeoState,
  ctx: GeoEngineContext,
  reason: GeoFinishReason,
  winnerSeat: Seat | null = null,
  outcomeOverride: ResultSpec["outcome"] | null = null,
): ResultSpec {
  const [first, second] = state.totals;
  const outcome = outcomeOverride ?? (winnerSeat === null ? (first === second ? "draw" : "win") : "win");
  const resolvedWinner = outcome === "win"
    ? (winnerSeat ?? (first > second ? 0 : 1))
    : null;
  return {
    kind: "competitive",
    outcome,
    winnerId: resolvedWinner === null ? null : ctx.participants[resolvedWinner],
    reason,
    sharedScore: null,
    players: [
      { userId: ctx.participants[0], score: first, metrics: state.metrics[0] },
      { userId: ctx.participants[1], score: second, metrics: state.metrics[1] },
    ],
    summary: { totals: state.totals, rounds: state.round },
  };
}

function finishedState(state: GeoState, result: ResultSpec): GeoState {
  return {
    ...state,
    phase: "finished",
    acknowledgedBy: [],
    finishedOutcome: result.outcome === "cooperative" ? "abandoned" : result.outcome,
    finishedReason: result.reason as GeoFinishReason,
    winnerId: result.winnerId,
  };
}

function roundRecord(state: GeoState, city: GeoCity, ctx: GeoEngineContext): RoundRecord {
  return {
    roundNo: state.round,
    completedAt: iso(ctx.nowMs),
    summary: {
      cityId: city.inseeCode,
      city: {
        inseeCode: city.inseeCode,
        name: city.name,
        departmentCode: city.departmentCode,
        departmentName: city.departmentName,
        latitude: city.latitude,
        longitude: city.longitude,
      },
      placements: state.placements,
      totals: state.totals,
    },
  };
}

function advanceFromReveal(ctx: GeoEngineContext, state: GeoState, config: GeoConfig): GeoTransition {
  if (state.round >= config.rounds) {
    const result = resultFor(state, ctx, "round_limit");
    const finished = finishedState(state, result);
    return transition(ctx, finished, {
      phaseId: ctx.nextPhaseId,
      deadlineAt: null,
      deadlineKind: null,
      result,
      eventType: "MATCH_FINISHED",
    });
  }
  const next: GeoState = {
    ...state,
    phase: "placing",
    round: (state.round + 1) as number,
    turnInRound: 0,
    placements: [null, null],
    submitted: [false, false],
    acknowledgedBy: [],
  };
  return placingTransition(ctx, next, config, "ROUND_STARTED");
}

function completeCurrentRound(ctx: GeoEngineContext, state: GeoState, config: GeoConfig, eventType: string): GeoTransition {
  const city = findCity(ctx.content, state.cityIds[state.round - 1] ?? "");
  const next: GeoState = { ...state, phase: "reveal", acknowledgedBy: [] };
  const deadlineAt = iso(ctx.nowMs + 8000);
  return transition(ctx, next, {
    phaseId: ctx.nextPhaseId,
    deadlineAt,
    deadlineKind: "advance_reveal",
    jobs: [deadlineJob(ctx, "advance_reveal", ctx.nextPhaseId, deadlineAt)],
    roundRecords: [roundRecord(next, city, ctx)],
    eventType,
    eventPayload: { round: state.round },
  });
}

function applyMissed(metrics: GeoMetrics): GeoMetrics {
  return { ...metrics, missedPlacements: metrics.missedPlacements + 1 };
}

function applyPlacement(metrics: GeoMetrics, placement: GeoPlacement): GeoMetrics {
  return {
    distanceSumKm: metrics.distanceSumKm + placement.distanceKm,
    validPlacements: metrics.validPlacements + 1,
    missedPlacements: metrics.missedPlacements,
    bestDistanceKm:
      metrics.bestDistanceKm === null ? placement.distanceKm : Math.min(metrics.bestDistanceKm, placement.distanceKm),
  };
}

function finishTimeoutTurn(ctx: GeoEngineContext, state: GeoState, config: GeoConfig): GeoTransition {
  const seat = activeSeat(state);
  const submitted: [boolean, boolean] = [...state.submitted] as [boolean, boolean];
  submitted[seat] = true;
  const metrics: [GeoMetrics, GeoMetrics] = [...state.metrics] as [GeoMetrics, GeoMetrics];
  metrics[seat] = applyMissed(metrics[seat]);
  const timedOut: GeoState = { ...state, submitted, metrics };
  if (state.turnInRound === 0) {
    const next: GeoState = { ...timedOut, turnInRound: 1 };
    return placingTransition(ctx, next, config, "PLACEMENT_TIMED_OUT");
  }
  const reveal: GeoState = {
    ...timedOut,
    phase: "reveal",
    totals: [timedOut.totals[0], timedOut.totals[1]],
    acknowledgedBy: [],
  };
  return completeCurrentRound(ctx, reveal, config, "PLACEMENT_TIMED_OUT");
}

function composeChallenge(selections: [string[], string[]], firstSeat: Seat, rounds: number): string[] {
  const result: string[] = [];
  const first = selections[firstSeat];
  const second = selections[(1 - firstSeat) as Seat];
  for (let index = 0; index < rounds; index += 1) {
    const source = index % 2 === 0 ? first : second;
    const sourceIndex = Math.floor(index / 2);
    const cityId = source[sourceIndex];
    if (cityId !== undefined) result.push(cityId);
  }
  return result;
}

function resolvePreparationTimeout(ctx: GeoEngineContext, state: GeoState, config: GeoConfig): GeoTransition {
  const pool = poolFor(ctx.content, config);
  const byId = new Set<string>();
  const selections: [string[], string[]] = [[], []];
  const shuffledPool = shuffled(pool, ctx.entropy);
  let poolIndex = 0;
  for (const seat of [0, 1] as const) {
    const required = challengeSelectionLength(config.rounds, seat, state.firstSeat);
    const draft = state.challengeSelections[seat];
    const validDraft = draft.length === required ? draft.filter((id) => !byId.has(id)) : [];
    for (const cityId of validDraft) {
      try {
        validateSelection([cityId], 1, ctx.content, config);
      } catch {
        continue;
      }
      selections[seat].push(cityId);
      byId.add(cityId);
    }
    while (selections[seat].length < required) {
      const candidate = shuffledPool[poolIndex];
      poolIndex += 1;
      if (!candidate || byId.has(candidate.inseeCode)) continue;
      selections[seat].push(candidate.inseeCode);
      byId.add(candidate.inseeCode);
    }
  }
  const next: GeoState = {
    ...state,
    phase: "placing",
    cityIds: composeChallenge(selections, state.firstSeat, config.rounds),
    challengeSelections: selections,
    challengeConfirmed: [true, true],
    turnInRound: 0,
  };
  return placingTransition(ctx, next, config, "PREPARATION_TIMED_OUT");
}

function initialState(config: GeoRuntimeConfig, firstSeat: Seat): GeoState {
  return {
    schemaVersion: 1,
    phase: config.selection === "challenge" ? "select_cities" : "placing",
    round: 1,
    firstSeat,
    turnInRound: 0,
    cityIds: [],
    challengeSelections: [[], []],
    challengeConfirmed: [false, false],
    placements: [null, null],
    submitted: [false, false],
    totals: [0, 0],
    metrics: [emptyMetrics(), emptyMetrics()],
    acknowledgedBy: [],
    finishedOutcome: null,
    finishedReason: null,
    winnerId: null,
  };
}

export function initializeGeo(configInput: unknown, ctx: GeoEngineContext): GeoTransition {
  const config = geoRuntimeConfigSchema.parse(configInput);
  const firstSeat = config.firstSeat ?? (Math.floor(randomUnit(ctx.entropy, 0) * 2) as Seat);
  const state = initialState(config, firstSeat);
  if (config.selection === "random") {
    const pool = shuffled(poolFor(ctx.content, config), ctx.entropy, 1);
    state.cityIds = pool.slice(0, config.rounds).map((city) => city.inseeCode);
    return placingTransition({ ...ctx, phaseId: ctx.phaseId, nextPhaseId: ctx.phaseId }, state, config, "MATCH_STARTED");
  }
  const selection = config.challengeSelections ?? [[], []];
  state.challengeSelections = [ [...selection[0]], [...selection[1]] ];
  for (const seat of [0, 1] as const) {
    const required = challengeSelectionLength(config.rounds, seat, firstSeat);
    if (selection[seat].length > 0) validateSelection(selection[seat], required, ctx.content, config);
  }
  const deadlineAt = iso(ctx.nowMs + 180000);
  return transition(ctx, state, {
    phaseId: ctx.phaseId,
    deadlineAt,
    deadlineKind: "preparation_timeout",
    jobs: [deadlineJob(ctx, "preparation_timeout", ctx.phaseId, deadlineAt)],
    eventType: "MATCH_STARTED",
  });
}

export function reduceGeo(stateInput: unknown, action: GeoAction, configInput: unknown, ctx: GeoEngineContext): GeoTransition {
  const state = geoStateSchema.parse(stateInput);
  const config = geoConfigSchema.parse(configInput);
  const actorSeat = seatForActor(ctx);
  const cities = cityMap(ctx.content);

  if (state.phase === "finished") throw new GeoRuleError("MATCH_FINISHED");

  switch (action.type) {
    case "SET_CITY_SELECTION": {
      if (state.phase !== "select_cities") throw new GeoRuleError("SELECTION_CLOSED");
      if (state.challengeConfirmed[actorSeat]) throw new GeoRuleError("SELECTION_ALREADY_CONFIRMED");
      const required = challengeSelectionLength(config.rounds, actorSeat, state.firstSeat);
      validateSelection(action.cityIds, required, ctx.content, config);
      const selections: [string[], string[]] = [...state.challengeSelections] as [string[], string[]];
      selections[actorSeat] = [...action.cityIds];
      return transition(ctx, { ...state, challengeSelections: selections }, {
        phaseId: ctx.phaseId,
        deadlineAt: ctx.currentDeadlineAt ?? iso(ctx.nowMs + 180000),
        deadlineKind: ctx.currentDeadlineKind ?? "preparation_timeout",
        eventType: "CITY_SELECTION_UPDATED",
      });
    }
    case "CONFIRM_CITY_SELECTION": {
      if (state.phase !== "select_cities") throw new GeoRuleError("SELECTION_CLOSED");
      if (state.challengeConfirmed[actorSeat]) throw new GeoRuleError("SELECTION_ALREADY_CONFIRMED");
      const required = challengeSelectionLength(config.rounds, actorSeat, state.firstSeat);
      validateSelection(state.challengeSelections[actorSeat], required, ctx.content, config);
      const other = (1 - actorSeat) as Seat;
      if (state.challengeConfirmed[other]) {
        const overlap = state.challengeSelections[actorSeat].some((id) => state.challengeSelections[other].includes(id));
        if (overlap) throw new GeoRuleError("CITY_ALREADY_SELECTED");
      }
      const confirmed: [boolean, boolean] = [...state.challengeConfirmed] as [boolean, boolean];
      confirmed[actorSeat] = true;
      const nextBase: GeoState = { ...state, challengeConfirmed: confirmed };
      if (!confirmed[0] || !confirmed[1]) {
        return transition(ctx, nextBase, {
          phaseId: ctx.phaseId,
          deadlineAt: ctx.currentDeadlineAt ?? iso(ctx.nowMs + 180000),
          deadlineKind: ctx.currentDeadlineKind ?? "preparation_timeout",
          eventType: "CITY_SELECTION_CONFIRMED",
        });
      }
      const cityIds = composeChallenge(nextBase.challengeSelections, state.firstSeat, config.rounds);
      if (cityIds.length !== config.rounds || new Set(cityIds).size !== cityIds.length) {
        throw new GeoRuleError("CITY_ALREADY_SELECTED");
      }
      return placingTransition(ctx, { ...nextBase, phase: "placing", cityIds }, config, "CITY_SELECTIONS_READY");
    }
    case "PLACE_CITY": {
      if (state.phase !== "placing") throw new GeoRuleError("NOT_PLACING");
      if (activeSeat(state) !== actorSeat) throw new GeoRuleError("NOT_YOUR_TURN");
      if (state.submitted[actorSeat]) throw new GeoRuleError("PLACEMENT_ALREADY_SUBMITTED");
      const target = cities.get(state.cityIds[state.round - 1] ?? "");
      if (!target) throw new GeoRuleError("CITY_NOT_IN_PACK");
      try {
        assertValidGeoPoint({ latitude: action.latitude, longitude: action.longitude });
      } catch {
        throw new GeoRuleError("POINT_OUT_OF_BOUNDS");
      }
      const distanceKm = haversineDistanceKm(
        { latitude: target.latitude, longitude: target.longitude },
        { latitude: action.latitude, longitude: action.longitude },
      );
      const placement: GeoPlacement = {
        latitude: action.latitude,
        longitude: action.longitude,
        distanceKm,
        points: scoreDistanceKm(distanceKm),
      };
      const placements: [GeoPlacement | null, GeoPlacement | null] = [...state.placements] as [GeoPlacement | null, GeoPlacement | null];
      const submitted: [boolean, boolean] = [...state.submitted] as [boolean, boolean];
      const metrics: [GeoMetrics, GeoMetrics] = [...state.metrics] as [GeoMetrics, GeoMetrics];
      placements[actorSeat] = placement;
      submitted[actorSeat] = true;
      metrics[actorSeat] = applyPlacement(metrics[actorSeat], placement);
      const next: GeoState = { ...state, placements, submitted, metrics };
      if (state.turnInRound === 0) {
        return placingTransition(ctx, { ...next, turnInRound: 1 }, config, "PLACEMENT_SUBMITTED");
      }
      const totals: [number, number] = [
        state.totals[0] + (placements[0]?.points ?? 0),
        state.totals[1] + (placements[1]?.points ?? 0),
      ];
      return completeCurrentRound(ctx, { ...next, totals }, config, "ROUND_REVEALED");
    }
    case "NEXT": {
      if (state.phase !== "reveal") throw new GeoRuleError("NOT_REVEAL");
      if (state.acknowledgedBy.includes(ctx.actorId ?? "")) throw new GeoRuleError("ALREADY_ACKNOWLEDGED");
      const acknowledgedBy = [...state.acknowledgedBy, ctx.actorId ?? ""];
      const next = { ...state, acknowledgedBy };
      if (acknowledgedBy.length < 2) {
        return transition(ctx, next, {
          phaseId: ctx.phaseId,
          deadlineAt: ctx.currentDeadlineAt ?? iso(ctx.nowMs + 8000),
          deadlineKind: ctx.currentDeadlineKind ?? "advance_reveal",
          eventType: "REVEAL_ACKNOWLEDGED",
        });
      }
      return advanceFromReveal(ctx, next, config);
    }
    case "RESIGN":
      return resignTransition(ctx, state, actorSeat, "resign");
    case "CLAIM_FORFEIT":
      return resignTransition(ctx, state, actorSeat, "claimed_forfeit");
  }
}

function resignTransition(ctx: GeoEngineContext, state: GeoState, actorSeat: Seat, reason: "resign" | "claimed_forfeit"): GeoTransition {
  const winner = (1 - actorSeat) as Seat;
  const beforeFirstTurn = state.phase === "select_cities";
  const result = resultFor(
    state,
    ctx,
    reason,
    beforeFirstTurn ? null : winner,
    beforeFirstTurn ? "abandoned" : "win",
  );
  const finished = finishedState(state, result);
  return transition(ctx, finished, {
    phaseId: ctx.nextPhaseId,
    deadlineAt: null,
    deadlineKind: null,
    result,
    eventType: reason === "resign" ? "PLAYER_RESIGNED" : "FORFEIT_CLAIMED",
    eventPayload: { actorId: ctx.actorId },
  });
}

export function onGeoDeadline(stateInput: unknown, kind: string, configInput: unknown, ctx: GeoEngineContext): GeoTransition {
  const state = geoStateSchema.parse(stateInput);
  const config = geoConfigSchema.parse(configInput);
  if (state.phase === "finished") throw new GeoRuleError("MATCH_FINISHED");
  if (kind === "preparation_timeout" && state.phase === "select_cities") return resolvePreparationTimeout(ctx, state, config);
  if (kind === "turn_timeout" && state.phase === "placing") return finishTimeoutTurn(ctx, state, config);
  if (kind === "advance_reveal" && state.phase === "reveal") return advanceFromReveal(ctx, state, config);
  throw new GeoRuleError("STALE_DEADLINE");
}

export function shouldAbandonForAbsence(lastSeenAt: readonly [string, string], nowMs: number): boolean {
  const ages = lastSeenAt.map((value) => nowMs - Date.parse(value));
  return ages.every((age) => age >= 120_000) || ages.some((age) => age >= 180_000);
}

export function onGeoAbsence(stateInput: unknown, configInput: unknown, ctx: GeoEngineContext): GeoTransition {
  const state = geoStateSchema.parse(stateInput);
  geoConfigSchema.parse(configInput);
  if (state.phase === "finished") throw new GeoRuleError("MATCH_FINISHED");
  const result = resultFor(state, ctx, "absence", null, "abandoned");
  return transition(ctx, finishedState(state, result), {
    phaseId: ctx.nextPhaseId,
    deadlineAt: null,
    deadlineKind: null,
    result,
    eventType: "MATCH_ABANDONED",
    eventPayload: { reason: "absence" },
  });
}

export function geoActiveSeat(stateInput: unknown): Seat {
  return activeSeat(geoStateSchema.parse(stateInput));
}
