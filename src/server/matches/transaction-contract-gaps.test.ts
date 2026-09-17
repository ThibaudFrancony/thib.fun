import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appliedMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260909185440_geography_pack_and_rpc.sql"),
  "utf8",
);
const correctiveMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260913200823_step3_transactional_commit_and_job_recovery.sql"),
  "utf8",
);
const graceMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260917172349_step10_remove_forfeit_and_leave_grace.sql"),
  "utf8",
);
const commandsRoute = readFileSync(
  resolve(process.cwd(), "src/app/api/matches/[matchId]/commands/route.ts"),
  "utf8",
);

function functionSource(
  migration: string,
  schema: "public" | "private",
  name: string,
  nextName?: string,
  nextSchema: "public" | "private" = schema,
): string {
  const start = migration.indexOf(`create or replace function ${schema}.${name}`);
  if (start < 0) throw new Error(`Fonction SQL introuvable: ${name}`);
  const end = nextName
    ? migration.indexOf(`create or replace function ${nextSchema}.${nextName}`, start + 1)
    : migration.length;
  return migration.slice(start, end < 0 ? migration.length : end);
}

describe("contrat SQL de l'étape 3", () => {
  it("conserve la migration appliquée intacte et ajoute une migration distincte", () => {
    expect(appliedMigration).toContain("create or replace function public.server_commit_match");
    expect(correctiveMigration).toContain("Cette migration est additive");
    expect(correctiveMigration).not.toMatch(/\b(drop|truncate)\s+(table|schema)\b/i);
  });

  it("acquiert le verrou de partie avant le reçu et vérifie l'identité complète", () => {
    const source = functionSource(correctiveMigration, "public", "server_commit_match");
    const lock = source.indexOf("for update");
    const receipt = source.indexOf("from private.command_receipts");

    expect(lock).toBeGreaterThanOrEqual(0);
    expect(receipt).toBeGreaterThan(lock);
    expect(source).toContain("v_receipt_actor is distinct from v_actor_id");
    expect(source).toContain("v_receipt_type is distinct from v_command_type");
    expect(source).toContain("v_receipt_hash is distinct from v_command_hash");
  });

  it("conserve seulement les jobs explicites et protège les clés de phase", () => {
    const source = functionSource(correctiveMigration, "public", "server_commit_match");

    expect(source).toContain("jobsToCancel");
    expect(source).toContain("where id = v_cancel_id");
    expect(source).toContain("on conflict (dedupe_key) do nothing");
    const terminalGuard = source.indexOf("if v_result is not null");
    const terminalCancellation = source.indexOf("where match_id = v_match_id\n      and status in", terminalGuard);
    expect(terminalGuard).toBeGreaterThanOrEqual(0);
    expect(terminalCancellation).toBeGreaterThan(terminalGuard);
    expect(source.slice(0, terminalGuard)).not.toMatch(/update private\.jobs[\s\S]*where match_id = v_match_id[\s\S]*and status in/);
  });

  it("applique la grâce de 30 s et bloque définitivement le forfait", () => {
    const lower = graceMigration.toLowerCase();
    const start = lower.indexOf("create or replace function public.server_commit_match");
    const end = lower.indexOf("create or replace function public.server_finish_job", start + 1);
    const source = lower.slice(start, end < 0 ? lower.length : end);
    const joinStart = lower.indexOf("create or replace function public.server_join_room");
    const join = lower.slice(joinStart);

    expect(source).toContain("v_command_type <> 'resign'");
    expect(source).toContain("'claim_forfeit'");
    expect(source).toContain("interval '30 seconds'");
    expect(source).not.toContain("interval '90 seconds'");
    expect(source).not.toContain("'forfeit_not_available'");
    expect(join).toContain("v_room.status <> 'waiting'");
  });

  it("finalise résultat, statistiques et historique une seule fois", () => {
    const source = functionSource(correctiveMigration, "private", "record_match_result", "finalize_match_technical_error");

    expect(source).toContain("on conflict (match_id) do nothing");
    expect(source).toContain("get diagnostics v_inserted = row_count");
    expect(source).toContain("if v_inserted <> 1 then");
    expect(source).toContain("private.player_results");
    expect(source).toContain("public.player_game_stats");
    expect(source).toContain("public.history_entries");
    expect(correctiveMigration).toContain(
      "grant execute on function private.record_match_result(uuid, private.matches, jsonb, timestamptz) to service_role",
    );
  });

  it("finalise technical_error au cinquième échec sans gagnant", () => {
    const helper = functionSource(correctiveMigration, "private", "finalize_match_technical_error", "claim_due_jobs");
    const source = functionSource(correctiveMigration, "public", "server_fail_job", "server_commit_match");

    expect(source).toContain("if v_job.attempts >= 5 then");
    expect(source).toContain("private.finalize_match_technical_error");
    expect(helper).toContain("'outcome', 'abandoned'");
    expect(helper).toContain("'winnerId', null");
    expect(helper).toContain("'technical_error'");
    expect(helper).toContain("status = 'abandoned'");
  });

  it("reprend les baux échus et distingue les reprises temporisées", () => {
    const claim = functionSource(correctiveMigration, "private", "claim_due_jobs", "dispatch_due_jobs");
    const failure = functionSource(correctiveMigration, "public", "server_fail_job", "server_commit_match");
    const finish = functionSource(correctiveMigration, "public", "server_finish_job", "server_fail_job");

    expect(claim).toContain("j.status = 'running' and j.lease_until <= v_now");
    expect(claim).toContain("'jobId', id");
    expect(claim).toContain("'leaseToken', lease_token");
    expect(failure).toContain("interval '1 second'");
    expect(failure).toContain("interval '2 seconds'");
    expect(failure).toContain("interval '4 seconds'");
    expect(failure).toContain("interval '8 seconds'");
    expect(finish.indexOf("from private.matches")).toBeLessThan(finish.indexOf("from private.jobs"));
    expect(finish).toContain("next_job.status in ('pending', 'running')");
  });

  it("n'envoie au worker que l'identifiant et le bail", () => {
    const source = functionSource(
      correctiveMigration,
      "private",
      "dispatch_due_jobs",
      "server_set_room_ready",
      "public",
    );

    expect(source).toContain("body := jsonb_build_object('jobs', v_jobs)");
    expect(source).not.toContain("'matchId'");
    expect(source).not.toContain("'payload'");
    expect(source).not.toContain("'phaseId'");
  });

  it("protège le replay des commandes de salon sous le verrou du salon", () => {
    const source = functionSource(correctiveMigration, "public", "server_set_room_ready", "server_finish_job");
    const lock = source.indexOf("from private.rooms");
    const receipt = source.indexOf("from private.room_command_receipts");

    expect(lock).toBeGreaterThanOrEqual(0);
    expect(source.slice(lock)).toContain("for update");
    expect(receipt).toBeGreaterThan(lock);
    expect(source).toContain("v_receipt_actor is distinct from p_actor");
    expect(source).toContain("v_receipt_type is distinct from 'SET_READY'");
    expect(source).toContain("v_receipt_hash is distinct from v_expected_hash");
  });

  it("transmet le type d'action authentifié au commit pour les neuf jeux", () => {
    expect(commandsRoute.match(/commandType: parsedAction\.data\.type/g)).toHaveLength(9);
  });
});
