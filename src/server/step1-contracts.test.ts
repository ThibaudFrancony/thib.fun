import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { shouldAbandonForAbsence } from "@/games/geographie/engine";
import { shouldAbandonForUnoAbsence } from "@/games/uno/engine";
import { shouldAbandonForSkyjoAbsence } from "@/games/skyjo/engine";
import { shouldAbandonForTrouNoirAbsence } from "@/games/trou-noir/engine";
import { shouldAbandonForTtmcAbsence } from "@/games/ttmc/engine";
import { shouldAbandonForBombpartyAbsence } from "@/games/bombparty/engine";
import { shouldAbandonForCompatibiliteAbsence } from "@/games/compatibilite/engine";
import { shouldAbandonForLongueurOndeAbsence } from "@/games/longueur-onde/engine";
import { hashCommand } from "@/server/hash";
import { workerRequestSchema } from "@/server/jobs/worker";
import { createTestClock } from "@/test-support/clock";

const migrationPath = resolve(process.cwd(), "supabase/migrations/20260909185440_geography_pack_and_rpc.sql");
const cooperativeMigrationPath = resolve(process.cwd(), "supabase/migrations/20260911233839_longueur_onde_cooperative_result_triggers.sql");
const migration = () => readFileSync(migrationPath, "utf8");

const checks: Array<[string, (lastSeenAt: readonly [string, string], nowMs: number) => boolean]> = [
  ["Géographie", shouldAbandonForAbsence],
  ["UNO", shouldAbandonForUnoAbsence],
  ["Skyjo", shouldAbandonForSkyjoAbsence],
  ["Trou Noir", shouldAbandonForTrouNoirAbsence],
  ["TTMC", shouldAbandonForTtmcAbsence],
  ["BombParty", shouldAbandonForBombpartyAbsence],
  ["Compatibilité", shouldAbandonForCompatibiliteAbsence],
  ["Longueur d'onde", shouldAbandonForLongueurOndeAbsence],
];

const validJob = {
  jobId: "11111111-1111-4111-8111-111111111111",
  leaseToken: "22222222-2222-4222-8222-222222222222",
};

describe("contrats de l'étape 1", () => {
  it("accepte le corps minimal réellement attendu par le worker", () => {
    expect(workerRequestSchema.parse({ jobs: [validJob] })).toEqual({ jobs: [validJob] });
  });

  it.fails("signale le payload historique trop riche produit par le dispatcher", () => {
    expect(workerRequestSchema.parse({
      jobs: [{
        ...validJob,
        matchId: "33333333-3333-4333-8333-333333333333",
        kind: "turn_timeout",
        phaseId: "44444444-4444-4444-8444-444444444444",
        payload: {},
        runAt: "2026-09-13T00:00:00.000Z",
      }],
    })).toEqual({ jobs: [validJob] });
  });

  it("applique la grâce de présence avec une horloge contrôlable dans tous les moteurs", () => {
    const clock = createTestClock();
    const recent = new Date(clock.now() - 29_999).toISOString();
    const bothStale = new Date(clock.now() - 30_000).toISOString();
    const oneStale = new Date(clock.now() - 180_000).toISOString();
    for (const [name, check] of checks) {
      expect(check([recent, recent], clock.now()), `${name}: deux joueurs récents`).toBe(false);
      expect(check([bothStale, bothStale], clock.now()), `${name}: deux joueurs à 30 s`).toBe(true);
      expect(check([oneStale, recent], clock.now()), `${name}: un joueur à 180 s`).toBe(true);
    }
    clock.advanceBy(1);
    expect(clock.iso()).toBe("2026-01-01T00:00:00.001Z");
  });

  it("conserve une empreinte idempotente et sensible au payload", () => {
    const first = hashCommand("55555555-5555-4555-8555-555555555555", "alice", "RESIGN", { type: "RESIGN" });
    const retry = hashCommand("55555555-5555-4555-8555-555555555555", "alice", "RESIGN", { type: "RESIGN" });
    const different = hashCommand("55555555-5555-4555-8555-555555555555", "alice", "CLAIM_FORFEIT", { type: "CLAIM_FORFEIT" });
    expect(retry).toBe(first);
    expect(different).not.toBe(first);
  });

  it("garde les reçus système et de commande dans le commit atomique", () => {
    const sql = migration();
    expect(sql).toContain("private.job_receipts");
    expect(sql).toContain("private.command_receipts");
    expect(sql).toContain("payload_hash");
    expect(sql).toContain("where match_id = v_match_id and command_id = v_command_id");
  });

  it("conserve les quatre déclencheurs de résultat coopératif", () => {
    const sql = readFileSync(cooperativeMigrationPath, "utf8");
    for (const trigger of [
      "normalize_longueur_onde_player_result",
      "normalize_longueur_onde_history_entry",
      "normalize_longueur_onde_player_stats",
      "record_longueur_onde_pair_stats",
    ]) {
      expect(sql).toContain(`create trigger ${trigger}`);
    }
  });

  it.fails("signale la garde SQL qui bloque encore RESIGN après échéance", () => {
    expect(migration()).not.toMatch(/if v_match\.deadline_at is not null and v_match\.deadline_at <= clock_timestamp\(\) then raise exception 'DEADLINE_EXPIRED'/);
  });
});
