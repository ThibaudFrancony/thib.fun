import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const step3Migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260913200823_step3_transactional_commit_and_job_recovery.sql"),
  "utf8",
);
const step4Migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260913220544_step4_dispatch_quiz_judgments.sql"),
  "utf8",
);
const step4GuardMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260913223824_step4_quiz_reservation_phase_guards.sql"),
  "utf8",
);
const step4ReleaseMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260913225319_step4_release_ai_reservations.sql"),
  "utf8",
);
const worker = readFileSync(resolve(process.cwd(), "src/server/jobs/worker.ts"), "utf8");
const bodyReader = readFileSync(resolve(process.cwd(), "src/server/jobs/body.ts"), "utf8");

function functionSource(source: string, schema: "public" | "private", name: string, nextName?: string, nextSchema = schema): string {
  const start = source.indexOf(`create or replace function ${schema}.${name}`);
  if (start < 0) throw new Error(`Fonction SQL introuvable: ${schema}.${name}`);
  const end = nextName
    ? source.indexOf(`create or replace function ${nextSchema}.${nextName}`, start + 1)
    : source.length;
  return source.slice(start, end < 0 ? source.length : end);
}

describe("contrats de l'étape 4", () => {
  it("garde un contrat de job minimal et strict côté worker", () => {
    expect(worker).toContain("export const workerJobSchema = z.object({");
    expect(worker).toContain("jobId: z.string().uuid(),");
    expect(worker).toContain("leaseToken: z.string().uuid(),");
    expect(worker).toContain("}).strict();");
    expect(worker).toContain("jobs: z.array(workerJobSchema).min(1).max(4)");
  });

  it("construit le batch dispatcher avec les deux seules clés du worker", () => {
    const claim = functionSource(step3Migration, "private", "claim_due_jobs", "dispatch_due_jobs");
    const dispatch = functionSource(step3Migration, "private", "dispatch_due_jobs", "server_set_room_ready", "public");

    expect(claim).toContain("jsonb_build_object(");
    expect(claim).toContain("'jobId', id");
    expect(claim).toContain("'leaseToken', lease_token");
    expect(claim).not.toMatch(/'matchId'|'kind'|'phaseId'|'payload'|'runAt'/);
    expect(dispatch).toContain("body := jsonb_build_object('jobs', v_jobs)");
    expect(dispatch).not.toMatch(/'matchId'|'kind'|'phaseId'|'payload'|'runAt'/);
  });

  it("valide le bail puis relit le contexte privé, y compris après la correction", () => {
    const firstRead = "const context = await getJobContext(job.jobId, job.leaseToken);";
    expect(worker).toContain(firstRead);
    expect(worker).toContain("const latestContext = await getJobContext(job.jobId, job.leaseToken);");
    expect(worker).toContain("context.jobPayload");
    expect(worker).toContain("context.jobPhaseId !== context.phaseId");
    expect(worker).toContain("isCurrentJudgeAttempt(latestContext, attemptId, latestState)");
  });

  it("rattache le jugement au triplet match/job/attempt et n'impose pas deadline_at", () => {
    const prepare = functionSource(step4Migration, "public", "server_prepare_quiz_judgment", "server_reserve_ai_usage");
    const reserve = functionSource(step4GuardMigration, "public", "server_reserve_ai_usage", "server_settle_ai_usage");
    const commit = functionSource(step3Migration, "public", "server_commit_match");

    for (const source of [prepare, reserve]) {
      expect(source).toContain("v_job.phase_id is distinct from v_match.phase_id");
      expect(source).toContain("v_job.payload->>'attemptId'");
      expect(source).toContain("v_job.payload->>'phaseId'");
      expect(source).toContain("v_job.payload->>'expectedPhaseId'");
      expect(source).toContain("v_match.state->'currentAttempt'->>'id'");
    }
    expect(prepare).toContain("a.id = p_attempt_id and a.match_id = v_match.id");
    expect(reserve).toContain("update private.ai_job_budgets");
    expect(commit).toContain("v_job_kind <> 'judge_answer'");
    expect(commit).toContain("v_match.deadline_at is null or v_now < v_match.deadline_at");
  });

  it("borner le corps avant JSON.parse et réserver deux appels maximum par tentative", () => {
    expect(bodyReader).toContain("MAX_WORKER_BODY_BYTES = 16 * 1024");
    expect(bodyReader).toContain("declaredLength");
    expect(bodyReader).toContain("if (total > MAX_WORKER_BODY_BYTES)");
    expect(step4Migration).toContain("attempts_reserved smallint not null default 0");
    expect(step4Migration).toContain("constraint ai_job_budgets_job_match_unique");
    expect(step4Migration).toContain("v_budget.attempts_reserved >= v_budget.max_attempts");
    expect(step4Migration).toContain("unique (attempt_id, call_no)");
  });

  it("libère une réservation expirée sans abandonner le budget silencieusement", () => {
    expect(step4ReleaseMigration).toContain("create or replace function public.server_release_ai_reservation");
    expect(step4ReleaseMigration).toContain("'release_ai_reservation'");
    expect(step4ReleaseMigration).toContain("new.expires_at");
    expect(step4ReleaseMigration).toContain("status = 'unknown'");
    expect(step4ReleaseMigration).toContain("estimated_cost_usd = estimated_cost_usd + v_call.reserved_cost_usd");
    expect(step4ReleaseMigration).toContain("jobs_release_cancelled_ai_reservation");
    expect(worker).toContain("processAiReservationReleaseJob");
    expect(worker).toContain("context.jobKind === \"release_ai_reservation\"");
  });

  it("conserve les métriques privées et ne donne aucun droit de lecture au navigateur", () => {
    for (const table of ["quiz_attempts", "judgment_cache", "ai_usage_daily", "ai_calls", "ai_job_budgets"]) {
      expect(step4Migration).toContain(`create table if not exists private.${table}`);
    }
    expect(step4Migration).toContain("grant execute on function public.server_prepare_quiz_judgment");
    expect(step4Migration).toContain("grant execute on function public.server_reserve_ai_usage");
    expect(step4Migration).toContain("grant execute on function public.server_settle_ai_usage");
    expect(step4Migration).toMatch(/revoke all on function public\.server_prepare_quiz_judgment[\s\S]*from public, anon, authenticated/);
    expect(step4Migration).toMatch(/revoke all on function public\.server_settle_ai_usage[\s\S]*from public, anon, authenticated/);
  });
});
