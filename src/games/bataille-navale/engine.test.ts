import { describe, expect, it } from "vitest";
import {
  completeFleet,
  initializeNaval,
  isNavalDeadlineJobStale,
  onNavalAbsence,
  onNavalDeadline,
  randomFleet,
  reduceNaval,
  shouldAbandonForNavalAbsence,
  shipCells,
  validateFleetEntries,
  NAVAL_ENGINE_VERSION,
  NAVAL_RULES_VERSION,
  type NavalEngineContext,
  type NavalTransition,
} from "@/games/bataille-navale/engine";
import { NAVAL_SHIP_LENGTHS, navalConfigSchema } from "@/games/bataille-navale/config";
import { navalActionSchema, type NavalState } from "@/games/bataille-navale/types";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const MATCH = "33333333-3333-3333-3333-333333333333";
const PHASE = "44444444-4444-4444-4444-444444444444";
const NEXT = "55555555-5555-5555-5555-555555555555";

function entropy(length = 256): number[] {
  const values: number[] = [];
  for (let index = 0; index < length; index += 1) {
    values.push(((index * 2654435761) % 1000) / 1000);
  }
  return values;
}

function ctx(actorId: string | null, overrides: Partial<NavalEngineContext> = {}): NavalEngineContext {
  return {
    nowMs: Date.parse("2026-09-11T12:00:00.000Z"),
    actorId,
    matchId: MATCH,
    participants: [A, B],
    content: null,
    entropy: entropy(),
    phaseId: PHASE,
    nextPhaseId: NEXT,
    currentDeadlineAt: null,
    currentDeadlineKind: null,
    ...overrides,
  };
}

function entry(id: "carrier" | "battleship" | "cruiser" | "submarine" | "destroyer", row: number, col: number, orientation: "horizontal" | "vertical" = "horizontal") {
  return { id, row, col, orientation };
}

function fullFleet(): ReturnType<typeof entry>[] {
  return [
    entry("carrier", 0, 0),
    entry("battleship", 2, 0),
    entry("cruiser", 4, 0),
    entry("submarine", 6, 0, "vertical"),
    entry("destroyer", 9, 8),
  ];
}

function setupState(): NavalState {
  return initializeNaval({ turnSeconds: null }, ctx(A)).state;
}

function readyState(): NavalState {
  let state = setupState();
  state = reduceNaval(state, { type: "SET_FLEET", ships: fullFleet() }, { turnSeconds: null }, ctx(A)).state;
  state = reduceNaval(state, { type: "SET_FLEET", ships: fullFleet() }, { turnSeconds: null }, ctx(B)).state;
  state = reduceNaval(state, { type: "READY_FLEET" }, { turnSeconds: null }, ctx(A)).state;
  return state;
}

function playingState(): { state: NavalState; firstSeat: 0 | 1 } {
  // entropy()[0] vaut 0 : le premier tireur est le siège 0.
  const transition = reduceNaval(readyState(), { type: "READY_FLEET" }, { turnSeconds: null }, ctx(B));
  expect(transition.state.phase).toBe("playing");
  return { state: transition.state, firstSeat: transition.state.activeSeat };
}

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof Error ? error.message : "UNKNOWN";
  }
  throw new Error("expected a rule error");
}

describe("validation du placement", () => {
  it("accepte une flotte partielle valide pour la reprise", () => {
    const ships = validateFleetEntries([entry("carrier", 0, 0), entry("destroyer", 9, 8)], { requireComplete: false });
    expect(ships).toHaveLength(2);
    expect(ships[0]).toMatchObject({ id: "carrier", length: 5 });
  });

  it("déduit les longueurs du catalogue, jamais du corps", () => {
    const parsed = navalActionSchema.safeParse({
      type: "SET_FLEET",
      ships: [{ id: "carrier", row: 0, col: 0, orientation: "horizontal", length: 99 }],
    });
    expect(parsed.success).toBe(false);
    const ships = validateFleetEntries([entry("carrier", 0, 0)], { requireComplete: false });
    expect(ships[0]?.length).toBe(NAVAL_SHIP_LENGTHS.carrier);
  });

  it("refuse les orientations, bords, chevauchements et doublons", () => {
    expect(codeOf(() => validateFleetEntries([entry("carrier", 0, 6)], { requireComplete: false }))).toBe("SHIP_OUT_OF_BOUNDS");
    expect(codeOf(() => validateFleetEntries([entry("submarine", 8, 0, "vertical")], { requireComplete: false }))).toBe(
      "SHIP_OUT_OF_BOUNDS",
    );
    expect(codeOf(() => validateFleetEntries([entry("carrier", 0, 0), entry("destroyer", 0, 3)], { requireComplete: false }))).toBe(
      "SHIPS_OVERLAP",
    );
    expect(codeOf(() => validateFleetEntries([entry("carrier", 0, 0), entry("carrier", 5, 5)], { requireComplete: false }))).toBe(
      "DUPLICATE_SHIP",
    );
    expect(codeOf(() => validateFleetEntries(fullFleet(), { requireComplete: false }).length && validateFleetEntries([entry("carrier", 0, 0)], { requireComplete: true }))).toBe(
      "INCOMPLETE_FLEET",
    );
  });

  it("autorise les contacts côtés et diagonales", () => {
    const ships = validateFleetEntries(
      [entry("carrier", 0, 0), entry("destroyer", 1, 0), entry("cruiser", 1, 5)],
      { requireComplete: false },
    );
    expect(ships).toHaveLength(3);
  });

  it("refuse les flottants et hors-limites dans les payloads", () => {
    expect(navalActionSchema.safeParse({ type: "FIRE", row: 1.5, col: 2 }).success).toBe(false);
    expect(navalActionSchema.safeParse({ type: "FIRE", row: 10, col: 0 }).success).toBe(false);
    expect(navalActionSchema.safeParse({ type: "FIRE", row: 0, col: -1 }).success).toBe(false);
    expect(
      navalActionSchema.safeParse({ type: "SET_FLEET", ships: [{ id: "carrier", row: 0.5, col: 0, orientation: "horizontal" }] }).success,
    ).toBe(false);
  });
});

describe("placement aléatoire", () => {
  it("produit 17 cases sans chevauchement", () => {
    const fleet = randomFleet(entropy());
    expect(fleet).toHaveLength(5);
    const cells = fleet.flatMap(shipCells);
    expect(cells).toHaveLength(17);
    expect(new Set(cells.map((cell) => `${cell.row}:${cell.col}`)).size).toBe(17);
    for (const ship of fleet) {
      for (const cell of shipCells(ship)) {
        expect(cell.row).toBeGreaterThanOrEqual(0);
        expect(cell.row).toBeLessThan(10);
        expect(cell.col).toBeGreaterThanOrEqual(0);
        expect(cell.col).toBeLessThan(10);
      }
    }
  });

  it("complète un partiel en conservant les bateaux fixés", () => {
    const fixed = validateFleetEntries([entry("carrier", 0, 0), entry("destroyer", 9, 8)], { requireComplete: false });
    const completed = completeFleet(fixed, entropy());
    expect(completed).toHaveLength(5);
    expect(completed).toContainEqual({ id: "carrier", row: 0, col: 0, orientation: "horizontal", length: 5 });
    expect(completed).toContainEqual({ id: "destroyer", row: 9, col: 8, orientation: "horizontal", length: 2 });
    const cells = completed.flatMap(shipCells);
    expect(new Set(cells.map((cell) => `${cell.row}:${cell.col}`)).size).toBe(17);
  });

  it("complète une flotte vide en flotte valide de 17 cases", () => {
    const completed = completeFleet([], entropy());
    expect(completed).toHaveLength(5);
    const cells = completed.flatMap(shipCells);
    expect(cells).toHaveLength(17);
    expect(new Set(cells.map((cell) => `${cell.row}:${cell.col}`)).size).toBe(17);
  });
});

describe("préparation et démarrage", () => {
  it("enregistre un brouillon partiel et conserve l'échéance de préparation", () => {
    const before = setupState();
    const transition = reduceNaval(before, { type: "SET_FLEET", ships: [entry("carrier", 0, 0)] }, { turnSeconds: null }, ctx(A));
    expect(transition.state.fleets[0]).toHaveLength(1);
    expect(transition.state.phase).toBe("setup");
    expect(transition.phaseId).toBe(PHASE);
    expect(transition.deadlineKind).toBe("preparation_timeout");
  });

  it("remplace toute la flotte sur RANDOMIZE volontaire", () => {
    const placed = reduceNaval(setupState(), { type: "SET_FLEET", ships: [entry("carrier", 0, 0)] }, { turnSeconds: null }, ctx(A));
    const randomized = reduceNaval(placed.state, { type: "RANDOMIZE_FLEET" }, { turnSeconds: null }, ctx(A));
    expect(randomized.state.fleets[0]).toHaveLength(5);
  });

  it("exige cinq bateaux uniques et valides pour READY", () => {
    const placed = reduceNaval(setupState(), { type: "SET_FLEET", ships: [entry("carrier", 0, 0)] }, { turnSeconds: null }, ctx(A));
    expect(codeOf(() => reduceNaval(placed.state, { type: "READY_FLEET" }, { turnSeconds: null }, ctx(A)))).toBe("INCOMPLETE_FLEET");
  });

  it("interdit toute modification après READY", () => {
    let state = setupState();
    state = reduceNaval(state, { type: "SET_FLEET", ships: fullFleet() }, { turnSeconds: null }, ctx(A)).state;
    state = reduceNaval(state, { type: "READY_FLEET" }, { turnSeconds: null }, ctx(A)).state;
    expect(codeOf(() => reduceNaval(state, { type: "SET_FLEET", ships: [] }, { turnSeconds: null }, ctx(A)))).toBe("ALREADY_SUBMITTED");
    expect(codeOf(() => reduceNaval(state, { type: "RANDOMIZE_FLEET" }, { turnSeconds: null }, ctx(A)))).toBe("ALREADY_SUBMITTED");
    expect(codeOf(() => reduceNaval(state, { type: "READY_FLEET" }, { turnSeconds: null }, ctx(A)))).toBe("ALREADY_SUBMITTED");
  });

  it("UNREADY seulement avant le ready adverse", () => {
    let state = readyState();
    state = reduceNaval(state, { type: "UNREADY_FLEET" }, { turnSeconds: null }, ctx(A)).state;
    expect(state.ready).toEqual([false, false]);
    expect(codeOf(() => reduceNaval(state, { type: "UNREADY_FLEET" }, { turnSeconds: null }, ctx(A)))).toBe("ILLEGAL_MOVE");
    // Adversaire prêt : UNREADY refusé.
    let locked = setupState();
    locked = reduceNaval(locked, { type: "SET_FLEET", ships: fullFleet() }, { turnSeconds: null }, ctx(A)).state;
    locked = reduceNaval(locked, { type: "SET_FLEET", ships: fullFleet() }, { turnSeconds: null }, ctx(B)).state;
    locked = reduceNaval(locked, { type: "READY_FLEET" }, { turnSeconds: null }, ctx(A)).state;
    locked = reduceNaval(locked, { type: "READY_FLEET" }, { turnSeconds: null }, ctx(B)).state;
    expect(locked.phase).toBe("playing");
    expect(codeOf(() => reduceNaval(locked, { type: "UNREADY_FLEET" }, { turnSeconds: null }, ctx(A)))).toBe("WRONG_PHASE");
  });

  it("RESIGN pendant la préparation abandonne sans vainqueur", () => {
    const placed = reduceNaval(setupState(), { type: "SET_FLEET", ships: [entry("carrier", 0, 0)] }, { turnSeconds: null }, ctx(A));
    const transition = reduceNaval(placed.state, { type: "RESIGN" }, { turnSeconds: null }, ctx(A));
    expect(transition.state.phase).toBe("finished");
    expect(transition.result?.outcome).toBe("abandoned");
    expect(transition.result?.winnerId).toBeNull();
  });

  it("deux READY démarrent une seule fois, le premier tireur vient du serveur", () => {
    const { state, firstSeat } = playingState();
    expect(state.ready).toEqual([true, true]);
    expect(firstSeat).toBe(0);
    expect(codeOf(() => reduceNaval(state, { type: "READY_FLEET" }, { turnSeconds: null }, ctx(A)))).toBe("WRONG_PHASE");
    const otherFirst = reduceNaval(readyState(), { type: "READY_FLEET" }, { turnSeconds: null }, ctx(B, { entropy: [0.9, ...entropy()] }));
    expect(otherFirst.state.activeSeat).toBe(1);
  });
});

describe("tirs", () => {
  it("un tir manqué passe le tour sans rejouer", () => {
    const { state } = playingState();
    const transition = reduceNaval(state, { type: "FIRE", row: 9, col: 0 }, { turnSeconds: null }, ctx(A));
    expect(transition.state.shots[0]).toHaveLength(1);
    expect(transition.state.shots[0][0]).toMatchObject({ row: 9, col: 0, result: "miss", automatic: false });
    expect(transition.state.activeSeat).toBe(1);
    expect(transition.state.turn).toBe(2);
  });

  it("une touche ne fait pas rejouer et le doublon est refusé sans mutation", () => {
    const { state } = playingState();
    const hit = reduceNaval(state, { type: "FIRE", row: 0, col: 0 }, { turnSeconds: null }, ctx(A));
    expect(hit.state.shots[0][0]).toMatchObject({ result: "hit" });
    expect(hit.state.activeSeat).toBe(1);
    const before = hit.state;
    expect(codeOf(() => reduceNaval(hit.state, { type: "FIRE", row: 5, col: 5 }, { turnSeconds: null }, ctx(A)))).toBe("NOT_YOUR_TURN");
    const reply = reduceNaval(hit.state, { type: "FIRE", row: 9, col: 9 }, { turnSeconds: null }, ctx(B));
    expect(codeOf(() => reduceNaval(reply.state, { type: "FIRE", row: 0, col: 0 }, { turnSeconds: null }, ctx(A)))).toBe("ALREADY_SUBMITTED");
    expect(reply.state.shots[0]).toHaveLength(1);
    expect(before.shots[0]).toHaveLength(1);
  });

  it("coule seulement quand toutes les cases du bateau sont touchées", () => {
    const { state } = playingState();
    // Destroyer adverse en (9,8)-(9,9).
    const first = reduceNaval(state, { type: "FIRE", row: 9, col: 8 }, { turnSeconds: null }, ctx(A));
    expect(first.state.shots[0][0]).toMatchObject({ result: "hit" });
    expect(first.state.shots[0][0]?.shipId).toBeUndefined();
    const other = reduceNaval(first.state, { type: "FIRE", row: 9, col: 0 }, { turnSeconds: null }, ctx(B));
    const sunk = reduceNaval(other.state, { type: "FIRE", row: 9, col: 9 }, { turnSeconds: null }, ctx(A));
    expect(sunk.state.shots[0][1]).toMatchObject({ result: "sunk", shipId: "destroyer", shipType: "destroyer" });
    expect(sunk.state.shots[0][1]?.sunkCells).toEqual([
      { row: 9, col: 8 },
      { row: 9, col: 9 },
    ]);
    expect(sunk.state.activeSeat).toBe(1);
  });

  it("un coulé expose shipId, type et cellules coulées calculés par le serveur", () => {
    const { state } = playingState();
    const first = reduceNaval(state, { type: "FIRE", row: 9, col: 8 }, { turnSeconds: null }, ctx(A));
    expect(first.state.shots[0][0]).toMatchObject({ result: "hit" });
    expect(first.state.shots[0][0]).not.toHaveProperty("shipId");
    expect(first.state.shots[0][0]).not.toHaveProperty("shipType");
    expect(first.state.shots[0][0]).not.toHaveProperty("sunkCells");
    const other = reduceNaval(first.state, { type: "FIRE", row: 9, col: 0 }, { turnSeconds: null }, ctx(B));
    const sunk = reduceNaval(other.state, { type: "FIRE", row: 9, col: 9 }, { turnSeconds: null }, ctx(A));
    const shot = sunk.state.shots[0][1];
    expect(shot).toMatchObject({ result: "sunk", shipId: "destroyer", shipType: "destroyer" });
    // Cellules du destroyer adverse, déduites de la flotte serveur.
    expect(shot?.sunkCells).toEqual([
      { row: 9, col: 8 },
      { row: 9, col: 9 },
    ]);
    // Le payload d'événement porte les mêmes détails sur coulé uniquement.
    expect(sunk.event.payload).toMatchObject({ shipId: "destroyer", shipType: "destroyer" });
    const miss = reduceNaval(sunk.state, { type: "FIRE", row: 0, col: 9 }, { turnSeconds: null }, ctx(B));
    expect(miss.event.payload).not.toHaveProperty("shipId");
    expect(miss.event.payload).not.toHaveProperty("shipType");
    expect(miss.event.payload).not.toHaveProperty("sunkCells");
  });

  it("le 17e point gagne immédiatement, une seule fois, sans dernier tour", () => {
    const { state } = playingState();
    const target = state.fleets[1].flatMap((ship) => shipCells(ship).map((cell) => ({ ...cell })));
    expect(target).toHaveLength(17);
    const targetKeys = new Set(target.map((cell) => `${cell.row}:${cell.col}`));
    const missCells: { row: number; col: number }[] = [];
    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 10; col += 1) {
        // Cases sûrement manquées sur la flotte A (aux bords droits).
        if (!targetKeys.has(`${row}:${col}`) && col >= 5) missCells.push({ row, col });
      }
    }
    let missIndex = 0;
    let current = state;
    let targetIndex = 0;
    // 16 touches du siège 0 en alternant avec des tirs manqués adverses.
    while (targetIndex < 16) {
      if (current.activeSeat === 0) {
        const cell = target[targetIndex++] as { row: number; col: number };
        current = reduceNaval(current, { type: "FIRE", row: cell.row, col: cell.col }, { turnSeconds: null }, ctx(A)).state;
      } else {
        const miss = missCells[missIndex++] as { row: number; col: number };
        current = reduceNaval(current, { type: "FIRE", row: miss.row, col: miss.col }, { turnSeconds: null }, ctx(B)).state;
      }
    }
    // Au tour du siège 0 avec 16 touches : le dernier tir gagne.
    while (current.activeSeat !== 0) {
      const miss = missCells[missIndex++] as { row: number; col: number };
      current = reduceNaval(current, { type: "FIRE", row: miss.row, col: miss.col }, { turnSeconds: null }, ctx(B)).state;
      if (current.phase === "finished") throw new Error("la partie ne doit pas finir sur un tir adverse manqué");
    }
    const last = target[16] as { row: number; col: number };
    const won = reduceNaval(current, { type: "FIRE", row: last.row, col: last.col }, { turnSeconds: null }, ctx(A));
    expect(won.state.phase).toBe("finished");
    expect(won.result?.outcome).toBe("win");
    expect(won.result?.winnerId).toBe(A);
    expect(won.result?.players[0].score).toBe(17);
    expect(won.roundRecords).toHaveLength(1);
    expect(codeOf(() => reduceNaval(won.state, { type: "FIRE", row: 5, col: 5 }, { turnSeconds: null }, ctx(B)))).toBe("MATCH_FINISHED");
  });
});

describe("échéances", () => {
  it("le timeout de préparation complète en conservant les bateaux fixés", () => {
    let state = setupState();
    state = reduceNaval(state, { type: "SET_FLEET", ships: [entry("carrier", 0, 0)] }, { turnSeconds: null }, ctx(A)).state;
    const transition = onNavalDeadline(state, "preparation_timeout", { turnSeconds: null }, ctx(null));
    expect(transition.state.phase).toBe("playing");
    expect(transition.state.ready).toEqual([true, true]);
    expect(transition.state.fleets[0]).toContainEqual({ id: "carrier", row: 0, col: 0, orientation: "horizontal", length: 5 });
    expect(transition.state.fleets[0]).toHaveLength(5);
    expect(transition.deadlineKind).toBeNull();
  });

  it("le timeout de préparation ne modifie pas un joueur déjà prêt", () => {
    let state = setupState();
    state = reduceNaval(state, { type: "SET_FLEET", ships: fullFleet() }, { turnSeconds: null }, ctx(A)).state;
    state = reduceNaval(state, { type: "READY_FLEET" }, { turnSeconds: null }, ctx(A)).state;
    const before = state.fleets[0];
    const transition = onNavalDeadline(state, "preparation_timeout", { turnSeconds: null }, ctx(null));
    expect(transition.state.fleets[0]).toEqual(before);
    expect(transition.state.phase).toBe("playing");
  });

  it("sans timer il n'y a pas de turn job et le timeout est périmé", () => {
    const { state } = playingState();
    expect(codeOf(() => onNavalDeadline(state, "turn_timeout", { turnSeconds: null }, ctx(null)))).toBe("STALE_DEADLINE");
  });

  it("le tir automatique ne vise qu'une case inconnue et peut gagner", () => {
    const { state } = playingState();
    const target = state.fleets[1].flatMap((ship) => shipCells(ship));
    // 16 touches du siège 0, une seule case inconnue restante sur la flotte.
    let current: NavalState = {
      ...state,
      activeSeat: 0,
      turn: 17,
      shots: [
        target.slice(0, 16).map((cell) => ({ row: cell.row, col: cell.col, result: "hit" as const, automatic: false })),
        [],
      ],
    };
    // Remplit toutes les autres cases inconnues par des tirs manqués déjà joués.
    const remaining = target[16] as { row: number; col: number };
    const played = new Set(current.shots[0].map((shot) => `${shot.row}:${shot.col}`));
    const misses: NavalState["shots"][0] = [];
    for (let row = 0; row < 10 && misses.length + 16 < 99; row += 1) {
      for (let col = 0; col < 10 && misses.length + 16 < 99; col += 1) {
        if (played.has(`${row}:${col}`) || (row === remaining.row && col === remaining.col)) continue;
        misses.push({ row, col, result: "miss", automatic: false });
      }
    }
    current = { ...current, shots: [[...current.shots[0], ...misses], []] };
    const transition = onNavalDeadline(
      current,
      "turn_timeout",
      { turnSeconds: 60 },
      ctx(null, { entropy: [0.123, ...entropy()] }),
    );
    expect(transition.state.phase).toBe("finished");
    expect(transition.result?.winnerId).toBe(A);
    expect(transition.event.type).toBe("AUTOMATIC_SHOT_WON");
    expect(transition.state.shots[0][transition.state.shots[0].length - 1]).toMatchObject({
      row: remaining.row,
      col: remaining.col,
      automatic: true,
    });
  });

  it("le timeout de préparation avec chrono arme l'échéance de tir", () => {
    const transition = onNavalDeadline(setupState(), "preparation_timeout", { turnSeconds: 60 }, ctx(null));
    expect(transition.state.phase).toBe("playing");
    expect(transition.deadlineKind).toBe("turn_timeout");
    expect(transition.deadlineAt).not.toBeNull();
    expect(transition.jobs).toHaveLength(1);
    expect(transition.jobs[0]).toMatchObject({ kind: "turn_timeout" });
  });

  it("un tir exactement à l'échéance est refusé avant mutation", () => {
    const { state } = playingState();
    const before = JSON.stringify(state);
    const deadline = new Date(Date.parse("2026-09-11T12:00:00.000Z")).toISOString();
    const context = ctx(A, { currentDeadlineAt: deadline, currentDeadlineKind: "turn_timeout" });
    expect(codeOf(() => reduceNaval(state, { type: "FIRE", row: 0, col: 0 }, { turnSeconds: 60 }, context))).toBe("DEADLINE_EXPIRED");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("un tir manuel après l'échéance est refusé, RESIGN reste possible", () => {
    const { state } = playingState();
    const past = new Date(Date.parse("2026-09-11T12:00:00.000Z") - 1000).toISOString();
    const context = ctx(A, { currentDeadlineAt: past, currentDeadlineKind: "turn_timeout" });
    expect(codeOf(() => reduceNaval(state, { type: "FIRE", row: 0, col: 0 }, { turnSeconds: 60 }, context))).toBe("DEADLINE_EXPIRED");
    const resigned = reduceNaval(state, { type: "RESIGN" }, { turnSeconds: 60 }, context);
    expect(resigned.state.phase).toBe("finished");
  });

  it("la garde phaseId invalide les vieux jobs", () => {
    expect(isNavalDeadlineJobStale(PHASE, PHASE)).toBe(false);
    expect(isNavalDeadlineJobStale(NEXT, PHASE)).toBe(true);
    expect(isNavalDeadlineJobStale(null, PHASE)).toBe(false);
    expect(isNavalDeadlineJobStale(undefined, PHASE)).toBe(false);
  });
});

describe("forfaits et absence", () => {
  it("RESIGN avant le premier tir abandonne sans vainqueur", () => {
    const { state } = playingState();
    const transition = reduceNaval(state, { type: "RESIGN" }, { turnSeconds: null }, ctx(A));
    expect(transition.state.phase).toBe("finished");
    expect(transition.result?.outcome).toBe("abandoned");
    expect(transition.result?.winnerId).toBeNull();
  });

  it("RESIGN après des tirs donne la victoire à l'adversaire, CLAIM au demandeur", () => {
    const { state } = playingState();
    const started = reduceNaval(state, { type: "FIRE", row: 9, col: 0 }, { turnSeconds: null }, ctx(A)).state;
    const resigned = reduceNaval(started, { type: "RESIGN" }, { turnSeconds: null }, ctx(B));
    expect(resigned.result?.winnerId).toBe(A);
    const claimed = reduceNaval(started, { type: "CLAIM_FORFEIT" }, { turnSeconds: null }, ctx(B));
    expect(claimed.result?.winnerId).toBe(B);
  });

  it("l'absence commune abandonne sans vainqueur", () => {
    expect(shouldAbandonForNavalAbsence(["2026-09-11T11:57:00.000Z", "2026-09-11T11:57:00.000Z"], Date.parse("2026-09-11T12:00:00.000Z"))).toBe(true);
    expect(shouldAbandonForNavalAbsence(["2026-09-11T11:59:30.000Z", "2026-09-11T11:56:00.000Z"], Date.parse("2026-09-11T12:00:00.000Z"))).toBe(true);
    expect(shouldAbandonForNavalAbsence(["2026-09-11T11:59:30.000Z", "2026-09-11T11:59:30.000Z"], Date.parse("2026-09-11T12:00:00.000Z"))).toBe(false);
    const { state } = playingState();
    const transition = onNavalAbsence(state, { turnSeconds: null }, ctx(null));
    expect(transition.result?.outcome).toBe("abandoned");
    expect(transition.result?.reason).toBe("absence");
  });
});

describe("versions et configuration", () => {
  it("expose des versions stables et une config stricte", () => {
    expect(NAVAL_RULES_VERSION).toBe("bataille-navale-1");
    expect(NAVAL_ENGINE_VERSION).toBe("bataille-navale-engine-1");
    expect(initializeNaval({ turnSeconds: null }, ctx(A)).state.schemaVersion).toBe(1);
  });

  it("le score final vaut les cases adverses touchées 0..17 avec métriques", () => {
    const { state } = playingState();
    const hit = reduceNaval(state, { type: "FIRE", row: 0, col: 0 }, { turnSeconds: null }, ctx(A));
    const other = reduceNaval(hit.state, { type: "FIRE", row: 9, col: 0 }, { turnSeconds: null }, ctx(B));
    const final = reduceNaval(other.state, { type: "RESIGN" }, { turnSeconds: null }, ctx(A));
    const metrics = final.result?.players[0].metrics as Record<string, unknown>;
    expect(metrics).toMatchObject({ shots: 1, hits: 1, misses: 0, sunkShips: 0, automaticShots: 0, precision: 1 });
    const loser = final.result?.players[1].metrics as Record<string, unknown>;
    expect(loser).toMatchObject({ shots: 1, hits: 0, misses: 1, precision: 0 });
  });

  it("la précision est nulle sans tir et le coulé compte dans sunkShips", () => {
    const { state } = playingState();
    // Destroyer adverse en (9,8)-(9,9) : deux touches le coulent.
    const first = reduceNaval(state, { type: "FIRE", row: 9, col: 8 }, { turnSeconds: null }, ctx(A));
    const other = reduceNaval(first.state, { type: "FIRE", row: 9, col: 0 }, { turnSeconds: null }, ctx(B));
    const sunk = reduceNaval(other.state, { type: "FIRE", row: 9, col: 9 }, { turnSeconds: null }, ctx(A));
    const reply = reduceNaval(sunk.state, { type: "FIRE", row: 9, col: 1 }, { turnSeconds: null }, ctx(B));
    const final = reduceNaval(reply.state, { type: "RESIGN" }, { turnSeconds: null }, ctx(A));
    const metrics = final.result?.players[0].metrics as Record<string, unknown>;
    expect(metrics).toMatchObject({ shots: 2, hits: 2, misses: 0, sunkShips: 1, automaticShots: 0, precision: 1 });
  });

  it("SET_FLEET refuse plus de cinq bateaux au schéma", () => {
    const ships = [...fullFleet(), entry("carrier", 5, 5)];
    expect(navalActionSchema.safeParse({ type: "SET_FLEET", ships }).success).toBe(false);
  });

  it("une action inconnue ou un acteur tiers est refusé", () => {
    const { state } = playingState();
    expect((navalActionSchema.safeParse({ type: "FIRE", row: 0, col: 0, extra: 1 }) as { success: boolean }).success).toBe(false);
    expect(codeOf(() => reduceNaval(state, { type: "FIRE", row: 0, col: 0 }, { turnSeconds: null }, ctx("tiers")))).toBe(
      "NOT_A_PARTICIPANT",
    );
  });
});

describe("cycle 2 — revue release", () => {
  it("config stricte : défaut null, 30/chaîne/clés inconnues refusés, IDs inconnus refusés", () => {
    expect(navalConfigSchema.parse({}).turnSeconds).toBeNull();
    expect(navalConfigSchema.parse({ turnSeconds: 60 }).turnSeconds).toBe(60);
    expect(navalConfigSchema.safeParse({ turnSeconds: 30 }).success).toBe(false);
    expect(navalConfigSchema.safeParse({ turnSeconds: "60" }).success).toBe(false);
    expect(navalConfigSchema.safeParse({ turnSeconds: null, grille: 12 }).success).toBe(false);
    expect(
      navalActionSchema.safeParse({
        type: "SET_FLEET",
        ships: [{ id: "porte-avions", row: 0, col: 0, orientation: "horizontal" }],
      }).success,
    ).toBe(false);
    expect(codeOf(() => validateFleetEntries([entry("carrier", 0, 0), entry("destroyer", 9, 9)], { requireComplete: true }))).toBe(
      "INCOMPLETE_FLEET",
    );
  });

  it("setup 180 s pile avec un seul job preparation_timeout", () => {
    const transition = initializeNaval({ turnSeconds: null }, ctx(A));
    expect(transition.deadlineAt).toBe("2026-09-11T12:03:00.000Z");
    expect(transition.deadlineKind).toBe("preparation_timeout");
    expect(transition.jobs).toHaveLength(1);
    expect(transition.jobs[0]).toMatchObject({ kind: "preparation_timeout" });
    expect(transition.state.turn).toBe(1);
  });

  it("tir répété refusé sans aucune mutation de l'état", () => {
    const { state } = playingState();
    const first = reduceNaval(state, { type: "FIRE", row: 0, col: 0 }, { turnSeconds: null }, ctx(A)).state;
    const second = reduceNaval(first, { type: "FIRE", row: 9, col: 0 }, { turnSeconds: null }, ctx(B)).state;
    const third = reduceNaval(second, { type: "FIRE", row: 0, col: 1 }, { turnSeconds: null }, ctx(A)).state;
    const before = JSON.stringify(third);
    expect(codeOf(() => reduceNaval(third, { type: "FIRE", row: 9, col: 0 }, { turnSeconds: null }, ctx(B)))).toBe(
      "ALREADY_SUBMITTED",
    );
    expect(JSON.stringify(third)).toBe(before);
  });

  it("CLAIM_FORFEIT pendant la préparation abandonne sans vainqueur", () => {
    const transition = reduceNaval(setupState(), { type: "CLAIM_FORFEIT" }, { turnSeconds: null }, ctx(B));
    expect(transition.state.phase).toBe("finished");
    expect(transition.result?.outcome).toBe("abandoned");
    expect(transition.result?.winnerId).toBeNull();
  });

  it("CLAIM_FORFEIT reste possible après l'échéance de tir", () => {
    const { state } = playingState();
    const past = new Date(Date.parse("2026-09-11T12:00:00.000Z") - 1000).toISOString();
    const context = ctx(B, { currentDeadlineAt: past, currentDeadlineKind: "turn_timeout" });
    expect(codeOf(() => reduceNaval(state, { type: "FIRE", row: 0, col: 0 }, { turnSeconds: 60 }, ctx(A, { currentDeadlineAt: past, currentDeadlineKind: "turn_timeout" })))).toBe(
      "DEADLINE_EXPIRED",
    );
    // Avant le premier tir : abandon sans vainqueur même après échéance.
    const claimed = reduceNaval(state, { type: "CLAIM_FORFEIT" }, { turnSeconds: 60 }, context);
    expect(claimed.result?.outcome).toBe("abandoned");
  });

  it("le tir automatique ne dépend pas de la flotte cachée et vise l'inconnu", () => {
    const { state } = playingState();
    const tried = [{ row: 5, col: 5, result: "miss" as const, automatic: false }];
    const first: NavalState = { ...state, activeSeat: 0, turn: 2, shots: [tried, []] };
    const otherFleet = randomFleet(entropy());
    const second: NavalState = { ...first, fleets: [first.fleets[0], otherFleet] };
    const config = { turnSeconds: 60 } as const;
    const firstPick = onNavalDeadline(first, "turn_timeout", config, ctx(null, { entropy: [0.5, ...entropy()] }));
    const secondPick = onNavalDeadline(second, "turn_timeout", config, ctx(null, { entropy: [0.5, ...entropy()] }));
    const firstShot = firstPick.state.shots[0][firstPick.state.shots[0].length - 1]!;
    const secondShot = secondPick.state.shots[0][secondPick.state.shots[0].length - 1]!;
    expect({ row: firstShot.row, col: firstShot.col }).toEqual({ row: secondShot.row, col: secondShot.col });
    expect(`${firstShot.row}:${firstShot.col}`).not.toBe("5:5");
    expect(firstShot.automatic).toBe(true);
    expect(firstPick.event.type).toBe("AUTOMATIC_SHOT");
  });

  it("les tirs automatiques sont comptés avec la précision exacte", () => {
    const { state } = playingState();
    const current: NavalState = {
      ...state,
      activeSeat: 0,
      turn: 2,
      shots: [[{ row: 5, col: 5, result: "miss" as const, automatic: false }], []],
    };
    const auto = onNavalDeadline(current, "turn_timeout", { turnSeconds: 60 }, ctx(null, { entropy: [0.5, ...entropy()] }));
    const final = reduceNaval(auto.state, { type: "RESIGN" }, { turnSeconds: 60 }, ctx(A));
    const metrics = final.result?.players[0].metrics as Record<string, unknown>;
    expect(metrics.shots).toBe(2);
    expect(metrics.automaticShots).toBe(1);
    expect(metrics.precision).toBe((metrics.hits as number) / 2);
  });

  it("complète une flotte partielle touchante sans chevauchement", () => {
    const fixed = validateFleetEntries([entry("carrier", 0, 0), entry("destroyer", 1, 0)], { requireComplete: false });
    const completed = completeFleet(fixed, entropy());
    expect(completed).toHaveLength(5);
    expect(completed).toContainEqual({ id: "carrier", row: 0, col: 0, orientation: "horizontal", length: 5 });
    const cells = completed.flatMap(shipCells);
    expect(cells).toHaveLength(17);
    expect(new Set(cells.map((cell) => `${cell.row}:${cell.col}`)).size).toBe(17);
  });

  it("le round record final contient flottes et journal des tirs", () => {
    const { state } = playingState();
    const target = state.fleets[1].flatMap((ship) => shipCells(ship));
    const current: NavalState = {
      ...state,
      activeSeat: 0,
      turn: 33,
      shots: [target.slice(0, 16).map((cell) => ({ row: cell.row, col: cell.col, result: "hit" as const, automatic: false })), []],
    };
    const last = target[16] as { row: number; col: number };
    const won = reduceNaval(current, { type: "FIRE", row: last.row, col: last.col }, { turnSeconds: null }, ctx(A));
    expect(won.state.phase).toBe("finished");
    expect(won.roundRecords).toHaveLength(1);
    const summary = won.roundRecords[0]?.summary as Record<string, unknown>;
    expect(summary.winnerSeat).toBe(0);
    expect(summary.fleets as unknown[]).toHaveLength(2);
    expect((summary.shots as [unknown[], unknown[]])[0]).toHaveLength(17);
    expect(won.result?.players[0].score).toBe(17);
  });
});

export type { NavalTransition };
