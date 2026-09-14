import { describe, expect, it } from "vitest";
import { type EngineContext } from "@/games/contracts";
import { DEFAULT_GEO_CONFIG } from "@/games/geographie/config";
import {
  geoActiveSeat,
  GeoRuleError,
  initializeGeo,
  onGeoAbsence,
  onGeoDeadline,
  reduceGeo,
  shouldAbandonForAbsence,
} from "@/games/geographie/engine";
import { projectGeo } from "@/games/geographie/projection";
import { haversineDistanceKm, scoreDistanceKm } from "@/games/geographie/scoring";
import type { GeoContent, GeoState } from "@/games/geographie/types";

const cities = [
  { inseeCode: "75056", name: "Paris", departmentCode: "75", departmentName: "Paris", latitude: 48.8566, longitude: 2.3522, population: 2100000, populationYear: 2023, difficulty: "easy" as const, sourceUrl: "https://example.test/paris" },
  { inseeCode: "69123", name: "Lyon", departmentCode: "69", departmentName: "Rhône", latitude: 45.764, longitude: 4.8357, population: 520000, populationYear: 2023, difficulty: "easy" as const, sourceUrl: "https://example.test/lyon" },
  { inseeCode: "13055", name: "Marseille", departmentCode: "13", departmentName: "Bouches-du-Rhône", latitude: 43.2965, longitude: 5.3698, population: 870000, populationYear: 2023, difficulty: "easy" as const, sourceUrl: "https://example.test/marseille" },
  { inseeCode: "31555", name: "Toulouse", departmentCode: "31", departmentName: "Haute-Garonne", latitude: 43.6047, longitude: 1.4442, population: 500000, populationYear: 2023, difficulty: "easy" as const, sourceUrl: "https://example.test/toulouse" },
  { inseeCode: "2A004", name: "Ajaccio", departmentCode: "2A", departmentName: "Corse-du-Sud", latitude: 41.9192, longitude: 8.7386, population: 70000, populationYear: 2023, difficulty: "easy" as const, sourceUrl: "https://example.test/ajaccio" },
  { inseeCode: "29019", name: "Brest", departmentCode: "29", departmentName: "Finistère", latitude: 48.3904, longitude: -4.4861, population: 140000, populationYear: 2023, difficulty: "easy" as const, sourceUrl: "https://example.test/brest" },
];

const content: GeoContent = { packId: "pack-geo", packVersion: 1, cities };
const participants = ["user-a", "user-b"] as const;

function context(overrides: Partial<EngineContext<GeoContent>> = {}): EngineContext<GeoContent> {
  return {
    nowMs: Date.parse("2026-01-01T12:00:00.000Z"),
    actorId: "user-a",
    matchId: "match-1",
    participants,
    content,
    entropy: Array.from({ length: 200 }, (_, index) => ((index * 37) % 100) / 100),
    phaseId: "00000000-0000-4000-8000-000000000001",
    nextPhaseId: "00000000-0000-4000-8000-000000000002",
    ...overrides,
  };
}

function stateForRandom(): GeoState {
  return initializeGeo({ ...DEFAULT_GEO_CONFIG, rounds: 5 }, context()).state;
}

describe("Géographie scoring", () => {
  it("calcule une distance nulle et conserve une grande précision", () => {
    expect(haversineDistanceKm({ latitude: 48.8566, longitude: 2.3522 }, { latitude: 48.8566, longitude: 2.3522 })).toBe(0);
    expect(haversineDistanceKm({ latitude: 48.8566, longitude: 2.3522 }, { latitude: 45.764, longitude: 4.8357 })).toBeGreaterThan(390);
    expect(haversineDistanceKm({ latitude: 48.8566, longitude: 2.3522 }, { latitude: 45.764, longitude: 4.8357 })).toBeLessThan(400);
  });

  it("applique les exemples de score contractuels", () => {
    expect(scoreDistanceKm(0)).toBe(1000);
    expect(scoreDistanceKm(5)).toBe(1000);
    expect(scoreDistanceKm(105)).toBe(368);
    expect(scoreDistanceKm(205)).toBe(135);
    expect(scoreDistanceKm(505)).toBe(7);
  });
});

describe("Géographie engine", () => {
  it("ne révèle pas le placement du premier au second joueur", () => {
    const first = stateForRandom();
    const placed = reduceGeo(first, { type: "PLACE_CITY", latitude: 48.8566, longitude: 2.3522 }, { ...DEFAULT_GEO_CONFIG, rounds: 5 }, context());
    const view = projectGeo(placed.state, { ...DEFAULT_GEO_CONFIG, rounds: 5 }, content, "user-b", participants, [
      { id: "user-a", pseudo: "Alice" },
      { id: "user-b", pseudo: "Bob" },
    ]);
    expect(view.players[0].submitted).toBe(true);
    expect(view.players[0].placement).toBeNull();
    expect(view.targetPoint).toBeNull();
    expect(view.totals).toEqual([0, 0]);
  });

  it("révèle et crédite les deux placements une seule fois", () => {
    const config = { ...DEFAULT_GEO_CONFIG, rounds: 5 };
    const first = stateForRandom();
    const a = reduceGeo(first, { type: "PLACE_CITY", latitude: 48.8566, longitude: 2.3522 }, config, context());
    const b = reduceGeo(a.state, { type: "PLACE_CITY", latitude: 45.764, longitude: 4.8357 }, config, context({ actorId: "user-b", phaseId: a.phaseId, nextPhaseId: "00000000-0000-4000-8000-000000000003" }));
    expect(b.state.phase).toBe("reveal");
    expect(b.state.totals[0]).toBeGreaterThanOrEqual(0);
    expect(b.state.totals[1]).toBeGreaterThanOrEqual(0);
    expect(b.roundRecords).toHaveLength(1);
    const next = reduceGeo(b.state, { type: "NEXT" }, config, context({ actorId: "user-a", phaseId: b.phaseId, nextPhaseId: "00000000-0000-4000-8000-000000000004" }));
    const done = reduceGeo(next.state, { type: "NEXT" }, config, context({ actorId: "user-b", phaseId: next.phaseId, nextPhaseId: "00000000-0000-4000-8000-000000000005" }));
    expect(done.state.round).toBe(2);
    expect(done.state.phase).toBe("placing");
    expect(done.state.totals).toEqual(b.state.totals);
  });

  it("alterne le premier joueur à chaque manche", () => {
    const initial = stateForRandom();
    expect(geoActiveSeat(initial)).toBe(initial.firstSeat);
    const afterFirst = { ...initial, round: 2, turnInRound: 0 };
    expect(geoActiveSeat(afterFirst)).toBe((1 - initial.firstSeat) as 0 | 1);
  });

  it("donne zéro point et une distance nulle au timeout", () => {
    const config = { ...DEFAULT_GEO_CONFIG, rounds: 5, turnSeconds: 30 };
    const initial = stateForRandom();
    const timed = onGeoDeadline(initial, "turn_timeout", config, context({ nextPhaseId: "00000000-0000-4000-8000-000000000006" }));
    expect(timed.state.submitted[initial.firstSeat]).toBe(true);
    expect(timed.state.placements[initial.firstSeat]).toBeNull();
    expect(timed.state.metrics[initial.firstSeat].missedPlacements).toBe(1);
    expect(timed.state.phase).toBe("placing");
  });

  it("refuse une coordonnée hors de la bbox", () => {
    expect(() => reduceGeo(stateForRandom(), { type: "PLACE_CITY", latitude: 20, longitude: 2 }, DEFAULT_GEO_CONFIG, context())).toThrowError(
      new GeoRuleError("POINT_OUT_OF_BOUNDS"),
    );
  });

  it("gère les listes challenge et masque la liste adverse", () => {
    const config = { ...DEFAULT_GEO_CONFIG, rounds: 5 as const, selection: "challenge" as const };
    const start = initializeGeo({ ...config, challengeSelections: [["75056", "69123", "13055"], ["31555", "2A004"]], firstSeat: 0 }, context()).state;
    const a = reduceGeo(start, { type: "CONFIRM_CITY_SELECTION" }, config, context());
    const b = reduceGeo(a.state, { type: "CONFIRM_CITY_SELECTION" }, config, context({ actorId: "user-b", phaseId: a.phaseId, nextPhaseId: "00000000-0000-4000-8000-000000000007" }));
    expect(b.state.phase).toBe("placing");
    const view = projectGeo(a.state, config, content, "user-b", participants, [
      { id: "user-a", pseudo: "Alice" },
      { id: "user-b", pseudo: "Bob" },
    ]);
    expect(view.challenge?.mySelection.map((city) => city.id)).toEqual(["31555", "2A004"]);
    expect(view.challenge?.opponentConfirmed).toBe(true);
  });

  it("conserve une fin d'abandon sans révéler le placement privé", () => {
    const config = { ...DEFAULT_GEO_CONFIG, rounds: 5 as const };
    const start = stateForRandom();
    const placed = reduceGeo(
      start,
      { type: "PLACE_CITY", latitude: 48.8566, longitude: 2.3522 },
      config,
      context(),
    );
    const resigned = reduceGeo(
      placed.state,
      { type: "RESIGN" },
      config,
      context({ phaseId: placed.phaseId, nextPhaseId: "00000000-0000-4000-8000-000000000008" }),
    );
    expect(resigned.result?.outcome).toBe("win");
    expect(resigned.result?.winnerId).toBe("user-b");
    expect(resigned.result?.reason).toBe("resign");
    for (const viewerId of participants) {
      const viewer = projectGeo(resigned.state, config, content, viewerId, participants, [
        { id: "user-a", pseudo: "Alice" },
        { id: "user-b", pseudo: "Bob" },
      ]);
      expect(viewer.result).toMatchObject({ outcome: "win", winnerId: "user-b", reason: "resign" });
      expect(viewer.players[0].placement).toEqual(viewerId === "user-a" ? { latitude: 48.8566, longitude: 2.3522 } : null);
      expect(viewer.players[1].placement).toBeNull();
      expect(viewer.targetPoint).toBeNull();
      expect(viewer.lastRound).toBeNull();
    }
  });

  it("attribue le forfait au siège qui le réclame après le premier tour", () => {
    const config = { ...DEFAULT_GEO_CONFIG, rounds: 5 as const };
    const start = stateForRandom();
    const placed = reduceGeo(start, { type: "PLACE_CITY", latitude: 48.8566, longitude: 2.3522 }, config, context());
    const claimedByAlice = reduceGeo(
      placed.state,
      { type: "CLAIM_FORFEIT" },
      config,
      context({ actorId: "user-a", phaseId: placed.phaseId, nextPhaseId: "00000000-0000-4000-8000-000000000010" }),
    );
    expect(claimedByAlice.result).toMatchObject({ outcome: "win", winnerId: "user-a", reason: "claimed_forfeit" });

    const claimedByBob = reduceGeo(
      placed.state,
      { type: "CLAIM_FORFEIT" },
      config,
      context({ actorId: "user-b", phaseId: placed.phaseId, nextPhaseId: "00000000-0000-4000-8000-000000000011" }),
    );
    expect(claimedByBob.result).toMatchObject({ outcome: "win", winnerId: "user-b", reason: "claimed_forfeit" });
  });

  it("interrompt aussi une sortie avant le premier placement en mode aléatoire", () => {
    const config = { ...DEFAULT_GEO_CONFIG, rounds: 5 as const };
    const start = stateForRandom();
    const resigned = reduceGeo(start, { type: "RESIGN" }, config, context());
    expect(resigned.result).toMatchObject({ outcome: "abandoned", winnerId: null, reason: "resign" });
  });

  it("refuse une préparation automatique sans entropie serveur", () => {
    const config = { ...DEFAULT_GEO_CONFIG, rounds: 5 as const, selection: "challenge" as const };
    const start = initializeGeo({ ...config, firstSeat: 0 }, context({ entropy: [] })).state;
    expect(() => onGeoDeadline(start, "preparation_timeout", config, context({ entropy: [] }))).toThrowError(new GeoRuleError("INVALID_ENTROPY"));
  });

  it("abandonne la préparation sans attribuer de victoire", () => {
    const config = { ...DEFAULT_GEO_CONFIG, rounds: 5 as const, selection: "challenge" as const };
    const start = initializeGeo({ ...config, firstSeat: 0 }, context()).state;
    const resigned = reduceGeo(start, { type: "RESIGN" }, config, context());
    expect(resigned.result?.outcome).toBe("abandoned");
    expect(resigned.result?.winnerId).toBeNull();
    expect(resigned.state.finishedOutcome).toBe("abandoned");
  });

  it("abandonne techniquement après les seuils de présence", () => {
    const now = Date.parse("2026-01-01T12:00:00.000Z");
    const recent = new Date(now - 119_999).toISOString();
    const old = new Date(now - 180_000).toISOString();
    expect(shouldAbandonForAbsence([recent, recent], now)).toBe(false);
    expect(shouldAbandonForAbsence([old, recent], now)).toBe(true);
    expect(shouldAbandonForAbsence([new Date(now - 120_000).toISOString(), new Date(now - 120_000).toISOString()], now)).toBe(true);
    const config = { ...DEFAULT_GEO_CONFIG, rounds: 5 as const };
    const transition = onGeoAbsence(stateForRandom(), config, context({ nextPhaseId: "00000000-0000-4000-8000-000000000009" }));
    expect(transition.result?.outcome).toBe("abandoned");
    expect(transition.result?.reason).toBe("absence");
  });
});
