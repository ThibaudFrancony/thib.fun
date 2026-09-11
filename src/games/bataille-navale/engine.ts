import type { EngineContext, JobSpec, ResultSpec, RoundRecord, Seat } from "@/games/contracts";
import {
  NAVAL_GRID_SIZE,
  NAVAL_SETUP_SECONDS,
  NAVAL_SHIP_CATALOG,
  NAVAL_SHIP_LENGTHS,
  NAVAL_TOTAL_CELLS,
  navalConfigSchema,
  type NavalConfig,
  type NavalShipId,
} from "@/games/bataille-navale/config";
import {
  navalActionSchema,
  navalStateSchema,
  type NavalAction,
  type NavalShip,
  type NavalShot,
  type NavalState,
} from "@/games/bataille-navale/types";

export const NAVAL_RULES_VERSION = "bataille-navale-1";
export const NAVAL_ENGINE_VERSION = "bataille-navale-engine-1";

export type NavalEngineContext = EngineContext<null>;

export type NavalTransition = {
  state: NavalState;
  phaseId: string;
  deadlineAt: string | null;
  deadlineKind: string | null;
  jobs: JobSpec[];
  roundRecords: RoundRecord[];
  result: ResultSpec | null;
  event: { type: string; payload: Record<string, unknown> };
};

export class NavalRuleError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "NavalRuleError";
    this.code = code;
  }
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function seatForActor(ctx: NavalEngineContext): Seat {
  const seat = ctx.participants.indexOf(ctx.actorId ?? "");
  if (seat !== 0 && seat !== 1) throw new NavalRuleError("NOT_A_PARTICIPANT");
  return seat;
}

function entropyUnit(entropy: readonly number[], index: number): number {
  const value = entropy[index];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value >= 1) {
    throw new NavalRuleError("INVALID_ENTROPY");
  }
  return value;
}

function rngFromEntropy(entropy: readonly number[], index: number): () => number {
  let seed = Math.floor(entropyUnit(entropy, index) * 4294967296);
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], entropy: readonly number[], offset: number): T[] {
  const rng = rngFromEntropy(entropy, offset);
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    const item = result[index] as T;
    result[index] = result[swap] as T;
    result[swap] = item;
  }
  return result;
}

function transition(
  ctx: NavalEngineContext,
  state: NavalState,
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
): NavalTransition {
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

function deadlineJob(ctx: NavalEngineContext, kind: string, phaseId: string, runAt: string): JobSpec {
  return {
    kind,
    phaseId,
    runAt,
    dedupeKey: `${ctx.matchId}:${phaseId}:${kind}`,
    payload: { matchId: ctx.matchId, phaseId, kind },
  };
}

function setupDeadline(ctx: NavalEngineContext, phaseId: string): { deadlineAt: string; jobs: JobSpec[] } {
  const deadlineAt = iso(ctx.nowMs + NAVAL_SETUP_SECONDS * 1000);
  return { deadlineAt, jobs: [deadlineJob(ctx, "preparation_timeout", phaseId, deadlineAt)] };
}

function turnDeadline(
  ctx: NavalEngineContext,
  config: NavalConfig,
  phaseId: string,
): { deadlineAt: string | null; jobs: JobSpec[] } {
  if (config.turnSeconds === null) return { deadlineAt: null, jobs: [] };
  const deadlineAt = iso(ctx.nowMs + config.turnSeconds * 1000);
  return { deadlineAt, jobs: [deadlineJob(ctx, "turn_timeout", phaseId, deadlineAt)] };
}

export function shipCells(ship: Pick<NavalShip, "row" | "col" | "orientation" | "length">): { row: number; col: number }[] {
  const cells: { row: number; col: number }[] = [];
  for (let offset = 0; offset < ship.length; offset += 1) {
    cells.push(
      ship.orientation === "horizontal" ? { row: ship.row, col: ship.col + offset } : { row: ship.row + offset, col: ship.col },
    );
  }
  return cells;
}

function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

function fleetCellMap(fleet: readonly NavalShip[]): Map<string, NavalShipId> {
  const map = new Map<string, NavalShipId>();
  for (const ship of fleet) {
    for (const cell of shipCells(ship)) {
      map.set(cellKey(cell.row, cell.col), ship.id);
    }
  }
  return map;
}

/**
 * Valide une flotte partielle ou complète. Les longueurs sont toujours
 * déduites du catalogue serveur, jamais du corps de la requête.
 * Les contacts entre bateaux (côtés et diagonales) sont autorisés.
 */
export function validateFleetEntries(
  entries: readonly { id: string; row: number; col: number; orientation: string }[],
  options: { requireComplete: boolean },
): NavalShip[] {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) throw new NavalRuleError("DUPLICATE_SHIP");
    seen.add(entry.id);
    if (!(entry.id in NAVAL_SHIP_LENGTHS)) throw new NavalRuleError("UNKNOWN_SHIP");
  }
  if (options.requireComplete) {
    if (entries.length !== NAVAL_SHIP_CATALOG.length) throw new NavalRuleError("INCOMPLETE_FLEET");
    for (const { id } of NAVAL_SHIP_CATALOG) {
      if (!seen.has(id)) throw new NavalRuleError("INCOMPLETE_FLEET");
    }
  }
  const ships: NavalShip[] = entries.map((entry) => ({
    id: entry.id as NavalShipId,
    row: entry.row,
    col: entry.col,
    orientation: entry.orientation as "horizontal" | "vertical",
    length: NAVAL_SHIP_LENGTHS[entry.id as NavalShipId],
  }));
  const occupied = new Set<string>();
  for (const ship of ships) {
    for (const cell of shipCells(ship)) {
      if (cell.row < 0 || cell.row >= NAVAL_GRID_SIZE || cell.col < 0 || cell.col >= NAVAL_GRID_SIZE) {
        throw new NavalRuleError("SHIP_OUT_OF_BOUNDS");
      }
      const key = cellKey(cell.row, cell.col);
      if (occupied.has(key)) throw new NavalRuleError("SHIPS_OVERLAP");
      occupied.add(key);
    }
  }
  return ships;
}

type Placement = { row: number; col: number; orientation: "horizontal" | "vertical" };

function placementsFor(length: number, blocked: ReadonlySet<string>): Placement[] {
  const placements: Placement[] = [];
  for (const orientation of ["horizontal", "vertical"] as const) {
    for (let row = 0; row < NAVAL_GRID_SIZE; row += 1) {
      for (let col = 0; col < NAVAL_GRID_SIZE; col += 1) {
        const cells: string[] = [];
        let fits = true;
        for (let offset = 0; offset < length; offset += 1) {
          const target = orientation === "horizontal" ? { row, col: col + offset } : { row: row + offset, col };
          if (target.row >= NAVAL_GRID_SIZE || target.col >= NAVAL_GRID_SIZE) {
            fits = false;
            break;
          }
          const key = cellKey(target.row, target.col);
          if (blocked.has(key)) {
            fits = false;
            break;
          }
          cells.push(key);
        }
        if (fits) {
          void cells;
          placements.push({ row, col, orientation });
        }
      }
    }
  }
  return placements;
}

function orderShipsForPlacement(ids: readonly NavalShipId[], entropy: readonly number[], offset: number): NavalShipId[] {
  const byLength = [...ids].sort((a, b) => NAVAL_SHIP_LENGTHS[b] - NAVAL_SHIP_LENGTHS[a]);
  return shuffled(byLength, entropy, offset);
}

/**
 * Backtracking fini : énumère les emplacements possibles (mélangés par
 * l'entropie serveur) au lieu d'une boucle aléatoire infinie.
 */
function backtrackPlace(
  ordered: readonly NavalShipId[],
  index: number,
  blocked: Set<string>,
  chosen: Map<NavalShipId, Placement>,
  entropy: readonly number[],
  cursor: { value: number },
): boolean {
  const id = ordered[index];
  if (!id) return true;
  const candidates = shuffled(placementsFor(NAVAL_SHIP_LENGTHS[id], blocked), entropy, cursor.value);
  cursor.value += 1;
  for (const placement of candidates) {
    const keys: string[] = [];
    for (let offset = 0; offset < NAVAL_SHIP_LENGTHS[id]; offset += 1) {
      const target =
        placement.orientation === "horizontal"
          ? { row: placement.row, col: placement.col + offset }
          : { row: placement.row + offset, col: placement.col };
      keys.push(cellKey(target.row, target.col));
    }
    for (const key of keys) blocked.add(key);
    chosen.set(id, placement);
    if (backtrackPlace(ordered, index + 1, blocked, chosen, entropy, cursor)) return true;
    for (const key of keys) blocked.delete(key);
    chosen.delete(id);
  }
  return false;
}

function shipsFromPlacements(chosen: ReadonlyMap<NavalShipId, Placement>): NavalShip[] {
  return [...chosen.entries()].map(([id, placement]) => ({
    id,
    row: placement.row,
    col: placement.col,
    orientation: placement.orientation,
    length: NAVAL_SHIP_LENGTHS[id],
  }));
}

/** Flotte complète aléatoire par backtracking fini. */
export function randomFleet(entropy: readonly number[], offset = 0): NavalShip[] {
  const ordered = orderShipsForPlacement(NAVAL_SHIP_CATALOG.map((entry) => entry.id), entropy, offset);
  const cursor = { value: offset + ordered.length };
  const blocked = new Set<string>();
  const chosen = new Map<NavalShipId, Placement>();
  if (!backtrackPlace(ordered, 0, blocked, chosen, entropy, cursor)) throw new NavalRuleError("MATCH_BLOCKED");
  return shipsFromPlacements(chosen);
}

/**
 * Complète une flotte partielle en conservant les bateaux déjà fixés.
 * Si aucun complément n'est possible, recommence sur la flotte entière.
 */
export function completeFleet(
  fixed: readonly NavalShip[],
  entropy: readonly number[],
  offset = 0,
): NavalShip[] {
  const validatedFixed = validateFleetEntries(
    fixed.map((ship) => ({ id: ship.id, row: ship.row, col: ship.col, orientation: ship.orientation })),
    { requireComplete: false },
  );
  const fixedIds = new Set(validatedFixed.map((ship) => ship.id));
  const remaining = NAVAL_SHIP_CATALOG.map((entry) => entry.id).filter((id) => !fixedIds.has(id));
  const blocked = new Set<string>();
  for (const ship of validatedFixed) {
    for (const cell of shipCells(ship)) blocked.add(cellKey(cell.row, cell.col));
  }
  const ordered = orderShipsForPlacement(remaining, entropy, offset);
  const cursor = { value: offset + ordered.length };
  const chosen = new Map<NavalShipId, Placement>();
  if (backtrackPlace(ordered, 0, blocked, chosen, entropy, cursor)) {
    return [...validatedFixed, ...shipsFromPlacements(chosen)];
  }
  return randomFleet(entropy, cursor.value);
}

function touchedCount(shots: readonly NavalShot[]): number {
  return shots.filter((shot) => shot.result === "hit" || shot.result === "sunk").length;
}

function sunkShipIds(shots: readonly NavalShot[]): string[] {
  const ids: string[] = [];
  for (const shot of shots) {
    if (shot.result === "sunk" && shot.shipId && !ids.includes(shot.shipId)) ids.push(shot.shipId);
  }
  return ids;
}

function metricsFor(shots: readonly NavalShot[], completedTurns: number): Record<string, unknown> {
  const hits = shots.filter((shot) => shot.result === "hit" || shot.result === "sunk").length;
  const misses = shots.filter((shot) => shot.result === "miss").length;
  return {
    shots: shots.length,
    hits,
    misses,
    sunkShips: sunkShipIds(shots).length,
    automaticShots: shots.filter((shot) => shot.automatic).length,
    precision: shots.length === 0 ? null : hits / shots.length,
    turns: completedTurns,
  };
}

function resultForWin(state: NavalState, ctx: NavalEngineContext, winnerSeat: Seat): ResultSpec {
  const loserSeat = (1 - winnerSeat) as Seat;
  return {
    kind: "competitive",
    outcome: "win",
    winnerId: ctx.participants[winnerSeat],
    reason: "normal",
    sharedScore: null,
    players: [
      { userId: ctx.participants[0], score: touchedCount(state.shots[0]), metrics: metricsFor(state.shots[0], state.turn) },
      { userId: ctx.participants[1], score: touchedCount(state.shots[1]), metrics: metricsFor(state.shots[1], state.turn) },
    ],
    summary: {
      winnerSeat,
      loserSeat,
      turns: state.turn,
      fleets: [state.fleets[0], state.fleets[1]],
      shots: [state.shots[0], state.shots[1]],
    },
  };
}

function finishedState(state: NavalState, result: ResultSpec): NavalState {
  return {
    ...state,
    phase: "finished",
    finishedOutcome: result.outcome === "win" ? "win" : result.outcome === "draw" ? "draw" : "abandoned",
    finishedReason: result.reason,
    winnerId: result.winnerId,
  };
}

function abandonResult(
  state: NavalState,
  ctx: NavalEngineContext,
  reason: "resign" | "claimed_forfeit" | "absence",
  winnerSeat: Seat | null,
): ResultSpec {
  const outcome = winnerSeat === null ? "abandoned" : "win";
  return {
    kind: "competitive",
    outcome,
    winnerId: winnerSeat === null ? null : ctx.participants[winnerSeat],
    reason,
    sharedScore: null,
    players: [
      { userId: ctx.participants[0], score: touchedCount(state.shots[0]), metrics: metricsFor(state.shots[0], state.turn) },
      { userId: ctx.participants[1], score: touchedCount(state.shots[1]), metrics: metricsFor(state.shots[1], state.turn) },
    ],
    summary: {
      turns: state.turn,
      fleets: [state.fleets[0], state.fleets[1]],
      shots: [state.shots[0], state.shots[1]],
    },
  };
}

function resolveShot(targetFleet: readonly NavalShip[], shots: readonly NavalShot[], row: number, col: number): NavalShot {
  const cellMap = fleetCellMap(targetFleet);
  const shipId = cellMap.get(cellKey(row, col));
  if (!shipId) return { row, col, result: "miss", automatic: false };
  const ship = targetFleet.find((entry) => entry.id === shipId);
  if (!ship) return { row, col, result: "miss", automatic: false };
  const cells = shipCells(ship);
  const hitKeys = new Set(shots.filter((shot) => shot.result === "hit" || shot.result === "sunk").map((shot) => cellKey(shot.row, shot.col)));
  hitKeys.add(cellKey(row, col));
  const sunk = cells.every((cell) => hitKeys.has(cellKey(cell.row, cell.col)));
  if (sunk) return { row, col, result: "sunk", shipId, shipType: shipId, sunkCells: cells, automatic: false };
  return { row, col, result: "hit", automatic: false };
}

function applyFire(
  ctx: NavalEngineContext,
  state: NavalState,
  config: NavalConfig,
  seat: Seat,
  row: number,
  col: number,
  automatic: boolean,
): NavalTransition {
  if (state.shots[seat].some((shot) => shot.row === row && shot.col === col)) {
    throw new NavalRuleError("ALREADY_SUBMITTED");
  }
  const resolved = resolveShot(state.fleets[(1 - seat) as Seat], state.shots[seat], row, col);
  const shot: NavalShot = { ...resolved, automatic };
  const shots: [NavalShot[], NavalShot[]] = [[...state.shots[0]], [...state.shots[1]]];
  shots[seat] = [...shots[seat], shot];
  const lastShot = { by: seat, shot } as NavalState["lastShot"];
  if (touchedCount(shots[seat]) >= NAVAL_TOTAL_CELLS) {
    const done: NavalState = { ...state, shots, lastShot, turn: state.turn };
    const result = resultForWin(done, ctx, seat);
    return transition(ctx, finishedState(done, result), {
      phaseId: ctx.nextPhaseId,
      deadlineAt: null,
      deadlineKind: null,
      roundRecords: [
        {
          roundNo: 1,
          completedAt: iso(ctx.nowMs),
          summary: {
            winnerSeat: seat,
            turns: state.turn,
            fleets: [state.fleets[0], state.fleets[1]],
            shots: [shots[0], shots[1]],
          },
        },
      ],
      result,
      eventType: automatic ? "AUTOMATIC_SHOT_WON" : "SHOT_WON",
      eventPayload:
        shot.result === "sunk"
          ? { by: seat, row, col, result: shot.result, shipId: shot.shipId, shipType: shot.shipType, sunkCells: shot.sunkCells, automatic }
          : { by: seat, row, col, result: shot.result, automatic },
    });
  }
  const nextSeat = (1 - seat) as Seat;
  const next: NavalState = { ...state, shots, lastShot, activeSeat: nextSeat, turn: state.turn + 1 };
  const phaseId = ctx.nextPhaseId;
  const { deadlineAt, jobs } = turnDeadline(ctx, config, phaseId);
  return transition(ctx, next, {
    phaseId,
    deadlineAt,
    deadlineKind: deadlineAt ? "turn_timeout" : null,
    jobs,
    eventType: automatic ? "AUTOMATIC_SHOT" : "SHOT_FIRED",
    eventPayload:
      shot.result === "sunk"
        ? { by: seat, row, col, result: shot.result, shipId: shot.shipId, shipType: shot.shipType, sunkCells: shot.sunkCells, automatic }
        : { by: seat, row, col, result: shot.result, automatic },
  });
}

function startPlaying(ctx: NavalEngineContext, state: NavalState, config: NavalConfig): NavalTransition {
  const firstSeat = (entropyUnit(ctx.entropy, 0) < 0.5 ? 0 : 1) as Seat;
  const next: NavalState = { ...state, phase: "playing", activeSeat: firstSeat };
  const phaseId = ctx.nextPhaseId;
  const { deadlineAt, jobs } = turnDeadline(ctx, config, phaseId);
  return transition(ctx, next, {
    phaseId,
    deadlineAt,
    deadlineKind: deadlineAt ? "turn_timeout" : null,
    jobs,
    eventType: "MATCH_STARTED",
    eventPayload: { firstSeat },
  });
}

export function initializeNaval(configInput: unknown, ctx: NavalEngineContext): NavalTransition {
  const config = navalConfigSchema.parse(configInput);
  void config;
  const state: NavalState = {
    schemaVersion: 1,
    phase: "setup",
    fleets: [[], []],
    ready: [false, false],
    activeSeat: 0,
    shots: [[], []],
    turn: 1,
    lastShot: null,
    finishedOutcome: null,
    finishedReason: null,
    winnerId: null,
  };
  const { deadlineAt, jobs } = setupDeadline(ctx, ctx.phaseId);
  return transition(ctx, state, {
    phaseId: ctx.phaseId,
    deadlineAt,
    deadlineKind: "preparation_timeout",
    jobs,
    eventType: "MATCH_STARTED",
  });
}

export function reduceNaval(
  stateInput: unknown,
  actionInput: NavalAction,
  configInput: unknown,
  ctx: NavalEngineContext,
): NavalTransition {
  const state = navalStateSchema.parse(stateInput);
  const action = navalActionSchema.parse(actionInput);
  const config = navalConfigSchema.parse(configInput);
  if (state.phase === "finished") throw new NavalRuleError("MATCH_FINISHED");
  const actorSeat = seatForActor(ctx);

  switch (action.type) {
    case "SET_FLEET": {
      if (state.phase !== "setup") throw new NavalRuleError("WRONG_PHASE");
      if (state.ready[actorSeat]) throw new NavalRuleError("ALREADY_SUBMITTED");
      const ships = validateFleetEntries(action.ships, { requireComplete: false });
      const fleets: [NavalShip[], NavalShip[]] = [[...state.fleets[0]], [...state.fleets[1]]];
      fleets[actorSeat] = ships;
      const next: NavalState = { ...state, fleets };
      return transition(ctx, next, {
        phaseId: ctx.phaseId,
        deadlineAt: ctx.currentDeadlineAt ?? iso(ctx.nowMs + NAVAL_SETUP_SECONDS * 1000),
        deadlineKind: ctx.currentDeadlineKind ?? "preparation_timeout",
        eventType: "FLEET_UPDATED",
        eventPayload: { seat: actorSeat, count: ships.length },
      });
    }
    case "RANDOMIZE_FLEET": {
      if (state.phase !== "setup") throw new NavalRuleError("WRONG_PHASE");
      if (state.ready[actorSeat]) throw new NavalRuleError("ALREADY_SUBMITTED");
      const fleets: [NavalShip[], NavalShip[]] = [[...state.fleets[0]], [...state.fleets[1]]];
      fleets[actorSeat] = randomFleet(ctx.entropy, 1);
      const next: NavalState = { ...state, fleets };
      return transition(ctx, next, {
        phaseId: ctx.phaseId,
        deadlineAt: ctx.currentDeadlineAt ?? iso(ctx.nowMs + NAVAL_SETUP_SECONDS * 1000),
        deadlineKind: ctx.currentDeadlineKind ?? "preparation_timeout",
        eventType: "FLEET_RANDOMIZED",
        eventPayload: { seat: actorSeat },
      });
    }
    case "READY_FLEET": {
      if (state.phase !== "setup") throw new NavalRuleError("WRONG_PHASE");
      if (state.ready[actorSeat]) throw new NavalRuleError("ALREADY_SUBMITTED");
      validateFleetEntries(
        state.fleets[actorSeat].map((ship) => ({ id: ship.id, row: ship.row, col: ship.col, orientation: ship.orientation })),
        { requireComplete: true },
      );
      const ready: [boolean, boolean] = [...state.ready] as [boolean, boolean];
      ready[actorSeat] = true;
      if (ready[0] && ready[1]) {
        return startPlaying(ctx, { ...state, ready }, config);
      }
      return transition(ctx, { ...state, ready }, {
        phaseId: ctx.phaseId,
        deadlineAt: ctx.currentDeadlineAt ?? iso(ctx.nowMs + NAVAL_SETUP_SECONDS * 1000),
        deadlineKind: ctx.currentDeadlineKind ?? "preparation_timeout",
        eventType: "FLEET_READY",
        eventPayload: { seat: actorSeat },
      });
    }
    case "UNREADY_FLEET": {
      if (state.phase !== "setup") throw new NavalRuleError("WRONG_PHASE");
      if (!state.ready[actorSeat]) throw new NavalRuleError("ILLEGAL_MOVE");
      if (state.ready[(1 - actorSeat) as Seat]) throw new NavalRuleError("ILLEGAL_MOVE");
      const ready: [boolean, boolean] = [...state.ready] as [boolean, boolean];
      ready[actorSeat] = false;
      return transition(ctx, { ...state, ready }, {
        phaseId: ctx.phaseId,
        deadlineAt: ctx.currentDeadlineAt ?? iso(ctx.nowMs + NAVAL_SETUP_SECONDS * 1000),
        deadlineKind: ctx.currentDeadlineKind ?? "preparation_timeout",
        eventType: "FLEET_UNREADY",
        eventPayload: { seat: actorSeat },
      });
    }
    case "FIRE": {
      if (state.phase !== "playing") throw new NavalRuleError("WRONG_PHASE");
      if (state.activeSeat !== actorSeat) throw new NavalRuleError("NOT_YOUR_TURN");
      if (ctx.currentDeadlineAt && ctx.nowMs >= Date.parse(ctx.currentDeadlineAt)) {
        throw new NavalRuleError("DEADLINE_EXPIRED");
      }
      return applyFire(ctx, state, config, actorSeat, action.row, action.col, false);
    }
    case "RESIGN":
      return abandonTransition(ctx, state, actorSeat, "resign");
    case "CLAIM_FORFEIT":
      return abandonTransition(ctx, state, actorSeat, "claimed_forfeit");
  }
}

function abandonTransition(
  ctx: NavalEngineContext,
  state: NavalState,
  actorSeat: Seat,
  reason: "resign" | "claimed_forfeit",
): NavalTransition {
  const beforeFirstShot = state.turn === 1 && state.shots[0].length === 0 && state.shots[1].length === 0;
  if (beforeFirstShot) {
    const result = abandonResult(state, ctx, reason, null);
    return transition(ctx, finishedState(state, result), {
      phaseId: ctx.nextPhaseId,
      deadlineAt: null,
      deadlineKind: null,
      result,
      eventType: reason === "resign" ? "PLAYER_RESIGNED" : "FORFEIT_CLAIMED",
      eventPayload: { actorId: ctx.actorId },
    });
  }
  const winner = (reason === "claimed_forfeit" ? actorSeat : ((1 - actorSeat) as Seat)) as Seat;
  const result = abandonResult(state, ctx, reason, winner);
  return transition(ctx, finishedState(state, result), {
    phaseId: ctx.nextPhaseId,
    deadlineAt: null,
    deadlineKind: null,
    result,
    eventType: reason === "resign" ? "PLAYER_RESIGNED" : "FORFEIT_CLAIMED",
    eventPayload: { actorId: ctx.actorId },
  });
}

export function onNavalDeadline(
  stateInput: unknown,
  kind: string,
  configInput: unknown,
  ctx: NavalEngineContext,
): NavalTransition {
  const state = navalStateSchema.parse(stateInput);
  const config = navalConfigSchema.parse(configInput);
  if (state.phase === "finished") throw new NavalRuleError("MATCH_FINISHED");

  if (state.phase === "setup" && kind === "preparation_timeout") {
    let next = state;
    let entropyOffset = 1;
    for (const seat of [0, 1] as const) {
      if (next.ready[seat]) continue;
      const completed = completeFleet(next.fleets[seat], ctx.entropy, entropyOffset);
      entropyOffset += 64;
      const fleets: [NavalShip[], NavalShip[]] = [[...next.fleets[0]], [...next.fleets[1]]];
      fleets[seat] = completed;
      const ready: [boolean, boolean] = [...next.ready] as [boolean, boolean];
      ready[seat] = true;
      next = { ...next, fleets, ready };
    }
    return startPlaying({ ...ctx, entropy: ctx.entropy.slice(0) }, next, config);
  }

  if (state.phase === "playing" && kind === "turn_timeout") {
    if (config.turnSeconds === null) throw new NavalRuleError("STALE_DEADLINE");
    const seat = state.activeSeat;
    const tried = new Set(state.shots[seat].map((shot) => cellKey(shot.row, shot.col)));
    const unknown: { row: number; col: number }[] = [];
    for (let row = 0; row < NAVAL_GRID_SIZE; row += 1) {
      for (let col = 0; col < NAVAL_GRID_SIZE; col += 1) {
        if (!tried.has(cellKey(row, col))) unknown.push({ row, col });
      }
    }
    if (unknown.length === 0) throw new NavalRuleError("MATCH_BLOCKED");
    // Choix serveur uniforme sur les cases inconnues, sans consulter la
    // flotte cachée adverse.
    const picked = unknown[Math.floor(entropyUnit(ctx.entropy, 0) * unknown.length)] as { row: number; col: number };
    return applyFire(ctx, state, config, seat, picked.row, picked.col, true);
  }

  throw new NavalRuleError("STALE_DEADLINE");
}

export function shouldAbandonForNavalAbsence(lastSeenAt: readonly [string, string], nowMs: number): boolean {
  const ages = lastSeenAt.map((value) => nowMs - Date.parse(value));
  return ages.every((age) => age >= 120_000) || ages.some((age) => age >= 180_000);
}

export function onNavalAbsence(stateInput: unknown, configInput: unknown, ctx: NavalEngineContext): NavalTransition {
  const state = navalStateSchema.parse(stateInput);
  navalConfigSchema.parse(configInput);
  if (state.phase === "finished") throw new NavalRuleError("MATCH_FINISHED");
  const result = abandonResult(state, ctx, "absence", null);
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
 * muter une phase ultérieure, même de même nom.
 */
export function isNavalDeadlineJobStale(jobPhaseId: string | null | undefined, currentPhaseId: string): boolean {
  if (!jobPhaseId) return false;
  return jobPhaseId !== currentPhaseId;
}
