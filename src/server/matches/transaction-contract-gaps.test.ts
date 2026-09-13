import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260909185440_geography_pack_and_rpc.sql"),
  "utf8",
);

function functionSource(name: string, nextName?: string): string {
  const start = migration.indexOf(`create or replace function public.${name}`);
  if (start < 0) throw new Error(`Fonction SQL introuvable: ${name}`);
  const end = nextName
    ? migration.indexOf(`create or replace function public.${nextName}`, start + 1)
    : migration.length;
  return migration.slice(start, end < 0 ? migration.length : end);
}

describe("sentinelles de l'étape 2 — écarts SQL encore à corriger", () => {
  it.fails("cherche le reçu de match après l'acquisition du verrou", () => {
    const source = functionSource("server_commit_match");
    const lock = source.indexOf("select * into v_match from private.matches where id = v_match_id for update");
    const receipt = source.indexOf("from private.command_receipts\n    where match_id = v_match_id and command_id = v_command_id");

    expect(lock).toBeGreaterThanOrEqual(0);
    expect(receipt).toBeGreaterThan(lock);
  });

  it.fails("revalide acteur, type et hash d'un reçu existant", () => {
    const source = functionSource("server_commit_match");

    expect(source).toMatch(
      /select\s+actor_id\s*,\s*action_type\s*,\s*payload_hash[\s\S]*from private\.command_receipts/,
    );
  });

  it.fails("n'annule que les jobs listés explicitement", () => {
    const source = functionSource("server_commit_match");

    expect(source).toContain("jobsToCancel");
    expect(source).not.toMatch(
      /update private\.jobs set status = 'cancelled'[\s\S]*where match_id = v_match_id and status in/,
    );
  });

  it.fails("finalise un match en technical_error après le cinquième échec", () => {
    const source = functionSource("server_fail_job", "server_start_match");

    expect(source).toContain("technical_error");
    expect(source).toMatch(/status\s*=\s*'abandoned'/);
  });

  it.fails("applique le replay vérifié aux commandes de salon", () => {
    const source = functionSource("server_set_room_ready", "server_finish_job");
    const lock = source.indexOf("select * into v_room from private.rooms where id = p_room_id for update");
    const receipt = source.indexOf("select actor_id, action_type, payload_hash");

    expect(lock).toBeGreaterThanOrEqual(0);
    expect(receipt).toBeGreaterThan(lock);
  });
});
