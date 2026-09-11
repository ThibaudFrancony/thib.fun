import { describe, expect, it } from "vitest";
import { projectNaval } from "@/games/bataille-navale/projection";
import { initializeNaval, reduceNaval, type NavalEngineContext } from "@/games/bataille-navale/engine";
import { navalStateSchema, type NavalState } from "@/games/bataille-navale/types";

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

function ctx(actorId: string | null): NavalEngineContext {
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
  };
}

const identities = [
  { id: A, pseudo: "Capitaine A" },
  { id: B, pseudo: "Capitaine B" },
] as const;

function entry(id: "carrier" | "battleship" | "cruiser" | "submarine" | "destroyer", row: number, col: number, orientation: "horizontal" | "vertical" = "horizontal") {
  return { id, row, col, orientation };
}

function fullFleet() {
  return [
    entry("carrier", 0, 0),
    entry("battleship", 2, 0),
    entry("cruiser", 4, 0),
    entry("submarine", 6, 0, "vertical"),
    entry("destroyer", 9, 8),
  ];
}

function fullFleetB() {
  // Flotte adverse volontairement différente pour détecter toute fuite.
  return [
    entry("carrier", 9, 0),
    entry("battleship", 0, 6),
    entry("cruiser", 2, 6),
    entry("submarine", 4, 6, "vertical"),
    entry("destroyer", 8, 0),
  ];
}

function playingState(): NavalState {
  let state = initializeNaval({ turnSeconds: null }, ctx(A)).state;
  state = reduceNaval(state, { type: "SET_FLEET", ships: fullFleet() }, { turnSeconds: null }, ctx(A)).state;
  state = reduceNaval(state, { type: "SET_FLEET", ships: fullFleetB() }, { turnSeconds: null }, ctx(B)).state;
  state = reduceNaval(state, { type: "READY_FLEET" }, { turnSeconds: null }, ctx(A)).state;
  state = reduceNaval(state, { type: "READY_FLEET" }, { turnSeconds: null }, ctx(B)).state;
  return state;
}

describe("projection navale", () => {
  it("montre ma flotte et les ready sans révéler la flotte adverse", () => {
    const state = playingState();
    const view = projectNaval(state, { turnSeconds: null }, A, [A, B], [...identities]);
    expect(view.myFleet).toHaveLength(5);
    expect(view.opponentFleet).toBeNull();
    expect(view.myReady).toBe(true);
    expect(view.opponentReady).toBe(true);
    expect(view.activePlayerId).toBe(A);
    expect(view.myShots).toHaveLength(0);
    // La flotte adverse (carrier en 9,0 chez B) ne doit pas fuiter.
    expect(JSON.stringify(view)).not.toContain('"row":9,"col":0,"orientation":"horizontal","length":5');
  });

  it("un hit simple n'expose pas le shipId, un coulé si", () => {
    // Flotte B : destroyer en (8,0)-(8,1).
    let state = playingState();
    state = reduceNaval(state, { type: "FIRE", row: 8, col: 0 }, { turnSeconds: null }, ctx(A)).state;
    const attacker = projectNaval(state, { turnSeconds: null }, A, [A, B], [...identities]);
    expect(attacker.myShots[0]).toMatchObject({ row: 8, col: 0, result: "hit" });
    expect(attacker.myShots[0]).not.toHaveProperty("shipId");
    expect(attacker.myShots[0]).not.toHaveProperty("shipType");
    expect(attacker.myShots[0]).not.toHaveProperty("sunkCells");
    expect(attacker.sunkByMe).toEqual([]);
    const defender = projectNaval(state, { turnSeconds: null }, B, [A, B], [...identities]);
    expect(defender.incomingShots[0]).toMatchObject({ row: 8, col: 0, result: "hit" });
    expect(defender.incomingShots[0]).not.toHaveProperty("shipId");
    expect(defender.incomingShots[0]).not.toHaveProperty("shipType");
    expect(defender.incomingShots[0]).not.toHaveProperty("sunkCells");

    state = reduceNaval(state, { type: "FIRE", row: 9, col: 0 }, { turnSeconds: null }, ctx(B)).state;
    const beforeSunk = projectNaval(
      reduceNaval(state, { type: "FIRE", row: 5, col: 5 }, { turnSeconds: null }, ctx(A)).state,
      { turnSeconds: null },
      A,
      [A, B],
      [...identities],
    );
    expect(beforeSunk.myShots[1]).toMatchObject({ result: "miss" });
    state = reduceNaval(state, { type: "FIRE", row: 5, col: 5 }, { turnSeconds: null }, ctx(A)).state;
    state = reduceNaval(state, { type: "FIRE", row: 0, col: 8 }, { turnSeconds: null }, ctx(B)).state;
    state = reduceNaval(state, { type: "FIRE", row: 8, col: 1 }, { turnSeconds: null }, ctx(A)).state;
    const sunk = projectNaval(state, { turnSeconds: null }, A, [A, B], [...identities]);
    expect(sunk.myShots.find((shot) => shot.result === "sunk")).toMatchObject({
      shipId: "destroyer",
      shipType: "destroyer",
    });
    expect(sunk.myShots.find((shot) => shot.result === "sunk")?.sunkCells).toEqual([
      { row: 8, col: 0 },
      { row: 8, col: 1 },
    ]);
    expect(sunk.sunkByMe).toEqual(["destroyer"]);
    // Le défenseur voit le même coulé sur ses tirs reçus, sans flotte révélée.
    const sunkDefender = projectNaval(state, { turnSeconds: null }, B, [A, B], [...identities]);
    expect(sunkDefender.incomingShots.find((shot) => shot.result === "sunk")).toMatchObject({
      shipId: "destroyer",
      shipType: "destroyer",
    });
    expect(sunkDefender.incomingShots.find((shot) => shot.result === "sunk")?.sunkCells).toEqual([
      { row: 8, col: 0 },
      { row: 8, col: 1 },
    ]);
    expect(sunkDefender.opponentFleet).toBeNull();
  });

  it("la fin révèle les deux flottes aux participants", () => {
    let state = playingState();
    state = reduceNaval(state, { type: "RESIGN" }, { turnSeconds: null }, ctx(A)).state;
    const view = projectNaval(state, { turnSeconds: null }, A, [A, B], [...identities]);
    expect(view.opponentFleet).toHaveLength(5);
    expect(view.result?.outcome).toBe("abandoned");
    // Les scores valent les cases adverses touchées.
    expect(view.players[0].score).toBe(0);
    expect(view.players[1].score).toBe(0);
  });

  it("expose les actions autorisées selon le tour et la phase", () => {
    const state = playingState();
    const attacker = projectNaval(state, { turnSeconds: null }, A, [A, B], [...identities]);
    expect(attacker.allowedActions).toContain("FIRE");
    const defender = projectNaval(state, { turnSeconds: null }, B, [A, B], [...identities]);
    expect(defender.allowedActions).not.toContain("FIRE");
    expect(defender.allowedActions).toContain("RESIGN");
  });

  it("le dernier tir reste distingué dans les deux vues", () => {
    let state = playingState();
    state = reduceNaval(state, { type: "FIRE", row: 3, col: 3 }, { turnSeconds: null }, ctx(A)).state;
    const viewA = projectNaval(state, { turnSeconds: null }, A, [A, B], [...identities]);
    const viewB = projectNaval(state, { turnSeconds: null }, B, [A, B], [...identities]);
    expect(viewA.lastShot).toMatchObject({ by: 0, shot: { row: 3, col: 3, result: "miss" } });
    expect(viewB.lastShot).toMatchObject({ by: 0, shot: { row: 3, col: 3, result: "miss" } });
  });

  it("la préparation expose le brouillon sans flotte adverse ni tour actif", () => {
    let state = initializeNaval({ turnSeconds: null }, ctx(A)).state;
    state = reduceNaval(state, { type: "SET_FLEET", ships: fullFleet() }, { turnSeconds: null }, ctx(A)).state;
    const view = projectNaval(state, { turnSeconds: null }, A, [A, B], [...identities]);
    expect(view.phase).toBe("setup");
    expect(view.myFleet).toHaveLength(5);
    expect(view.opponentFleet).toBeNull();
    expect(view.myReady).toBe(false);
    expect(view.opponentReady).toBe(false);
    expect(view.activePlayerId).toBeNull();
    expect(view.allowedActions).toContain("SET_FLEET");
    expect(view.allowedActions).toContain("RANDOMIZE_FLEET");
    expect(view.allowedActions).toContain("READY_FLEET");
    expect(view.allowedActions).not.toContain("FIRE");
  });

  it("après mon READY seul, je peux encore modifier tant que l'adversaire n'est pas prêt", () => {
    let state = initializeNaval({ turnSeconds: null }, ctx(A)).state;
    state = reduceNaval(state, { type: "SET_FLEET", ships: fullFleet() }, { turnSeconds: null }, ctx(A)).state;
    state = reduceNaval(state, { type: "READY_FLEET" }, { turnSeconds: null }, ctx(A)).state;
    const view = projectNaval(state, { turnSeconds: null }, A, [A, B], [...identities]);
    expect(view.myReady).toBe(true);
    expect(view.opponentReady).toBe(false);
    expect(view.allowedActions).toContain("UNREADY_FLEET");
    expect(view.allowedActions).not.toContain("READY_FLEET");
  });

  it("un tiers ne peut pas projeter la partie", () => {
    const state = playingState();
    expect(() => projectNaval(state, { turnSeconds: null }, "33333333-3333-3333-3333-333333333333", [A, B], [...identities])).toThrow();
  });

  it("l'état strict refuse les clés inconnues", () => {
    const state = playingState();
    expect(navalStateSchema.safeParse({ ...state, flotteAdverse: [] }).success).toBe(false);
  });
});
