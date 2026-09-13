-- Étape 4 — revalidation atomique de la tentative avant réservation IA.
-- Cette migration complète la précédente sans la modifier : une migration
-- déjà appliquée reste immuable. Aucun secret ou appel réseau n'est utilisé.

create or replace function public.server_reserve_ai_usage(
  p_job_id uuid,
  p_lease_token uuid,
  p_attempt_id uuid,
  p_provider text,
  p_model_id text,
  p_reserved_cost_usd numeric,
  p_daily_budget_usd numeric,
  p_daily_call_limit integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job private.jobs%rowtype;
  v_match private.matches%rowtype;
  v_attempt private.quiz_attempts%rowtype;
  v_budget private.ai_job_budgets%rowtype;
  v_usage private.ai_usage_daily%rowtype;
  v_call_no smallint;
  v_now timestamptz;
  v_day date;
  v_reserved numeric(14, 6) := coalesce(p_reserved_cost_usd, 0);
begin
  if p_job_id is null or p_lease_token is null or p_attempt_id is null
     or p_provider is null or btrim(p_provider) = ''
     or p_model_id is null or btrim(p_model_id) = ''
     or p_daily_budget_usd is null or p_daily_budget_usd <= 0
     or p_daily_call_limit is null or p_daily_call_limit <= 0
     or v_reserved < 0
  then
    raise exception 'INVALID_ENVELOPE';
  end if;

  -- Match then job is the canonical lock order for all worker mutations.
  select m.* into v_match
  from private.matches as m
  where m.id = (select j.match_id from private.jobs as j where j.id = p_job_id)
  for update;
  select j.* into v_job
  from private.jobs as j
  where j.id = p_job_id
  for update;
  v_now := clock_timestamp();
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if v_match.id is null then raise exception 'JOB_LEASE_INVALID'; end if;
  if v_job.status <> 'running'
     or v_job.lease_token is distinct from p_lease_token
     or v_job.lease_until is null or v_job.lease_until <= v_now
     or v_job.match_id is distinct from v_match.id
     or v_job.kind <> 'judge_answer'
  then
    raise exception 'JOB_LEASE_INVALID';
  end if;
  if v_job.phase_id is distinct from v_match.phase_id
     or v_job.payload->>'attemptId' is distinct from p_attempt_id::text
     or v_job.payload->>'phaseId' is distinct from v_match.phase_id::text
     or v_job.payload->>'expectedPhaseId' is distinct from v_match.phase_id::text
     or v_match.state->>'phase' <> 'judging'
     or v_match.state->'currentAttempt'->>'id' is distinct from p_attempt_id::text
  then
    raise exception 'STALE_JOB';
  end if;

  select * into v_attempt
  from private.quiz_attempts
  where id = p_attempt_id and match_id = v_match.id
  for update;
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  if v_attempt.phase_id is distinct from v_match.phase_id
     or v_attempt.status <> 'pending'
  then
    raise exception 'STALE_JOB';
  end if;

  insert into private.ai_job_budgets (job_id, match_id)
  values (v_job.id, v_match.id)
  on conflict (job_id) do nothing;
  select * into v_budget
  from private.ai_job_budgets
  where job_id = v_job.id
  for update;
  if v_budget.attempts_reserved >= v_budget.max_attempts then
    return jsonb_build_object('status', 'attempt_limit');
  end if;

  v_day := (v_now at time zone 'UTC')::date;
  insert into private.ai_usage_daily (day, provider, model_id, price_revision)
  values (v_day, p_provider, p_model_id, case when v_reserved > 0 then 'configured' else 'unavailable' end)
  on conflict (day, provider, model_id) do nothing;
  select * into v_usage
  from private.ai_usage_daily
  where day = v_day and provider = p_provider and model_id = p_model_id
  for update;
  if v_usage.calls >= p_daily_call_limit
     or v_usage.reserved_cost_usd + v_reserved > p_daily_budget_usd
  then
    return jsonb_build_object('status', 'daily_limit');
  end if;

  v_call_no := (v_budget.attempts_reserved + 1)::smallint;
  update private.ai_job_budgets
  set attempts_reserved = v_call_no, updated_at = v_now
  where job_id = v_job.id;
  update private.ai_usage_daily
  set calls = calls + 1,
      reserved_cost_usd = reserved_cost_usd + v_reserved,
      updated_at = v_now
  where day = v_day and provider = p_provider and model_id = p_model_id;
  insert into private.ai_calls (
    attempt_id, call_no, provider, model_id, status,
    reserved_cost_usd, reserved_at, expires_at
  )
  values (
    v_attempt.id, v_call_no, p_provider, p_model_id, 'reserved',
    v_reserved, v_now, v_now + interval '45 seconds'
  )
  on conflict (attempt_id, call_no) do nothing;
  return jsonb_build_object('status', 'reserved', 'callNo', v_call_no);
end;
$$;

create or replace function public.server_settle_ai_usage(
  p_job_id uuid,
  p_lease_token uuid,
  p_attempt_id uuid,
  p_call_no smallint,
  p_provider text,
  p_model_id text,
  p_status text,
  p_verdict jsonb default null,
  p_input_tokens integer default null,
  p_output_tokens integer default null,
  p_actual_cost_usd numeric default null,
  p_cache_key text default null,
  p_prompt_version text default null,
  p_policy_version text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job private.jobs%rowtype;
  v_match private.matches%rowtype;
  v_attempt private.quiz_attempts%rowtype;
  v_call private.ai_calls%rowtype;
  v_usage private.ai_usage_daily%rowtype;
  v_now timestamptz;
  v_day date;
  v_actual numeric(14, 6);
begin
  if p_job_id is null or p_lease_token is null or p_attempt_id is null
     or p_call_no not in (1, 2)
     or p_provider is null or p_model_id is null
     or p_status not in ('completed', 'failed', 'unknown')
     or p_input_tokens is not null and p_input_tokens < 0
     or p_output_tokens is not null and p_output_tokens < 0
     or p_actual_cost_usd is not null and p_actual_cost_usd < 0
  then
    raise exception 'INVALID_ENVELOPE';
  end if;

  select m.* into v_match
  from private.matches as m
  where m.id = (select j.match_id from private.jobs as j where j.id = p_job_id)
  for update;
  select j.* into v_job
  from private.jobs as j
  where j.id = p_job_id
  for update;
  v_now := clock_timestamp();
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if v_match.id is null then raise exception 'JOB_LEASE_INVALID'; end if;
  if v_job.status <> 'running'
     or v_job.lease_token is distinct from p_lease_token
     or v_job.lease_until is null or v_job.lease_until <= v_now
     or v_job.match_id is distinct from v_match.id
     or v_job.kind <> 'judge_answer'
  then
    raise exception 'JOB_LEASE_INVALID';
  end if;
  select * into v_attempt
  from private.quiz_attempts
  where id = p_attempt_id and match_id = v_match.id
  for update;
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  select * into v_call
  from private.ai_calls
  where attempt_id = p_attempt_id and call_no = p_call_no
  for update;
  if not found then raise exception 'AI_CALL_NOT_FOUND'; end if;
  if v_call.provider is distinct from p_provider or v_call.model_id is distinct from p_model_id then
    raise exception 'INVALID_ENVELOPE';
  end if;
  if v_call.status <> 'reserved' then
    return jsonb_build_object('status', v_call.status, 'callNo', p_call_no);
  end if;

  update private.ai_calls
  set status = p_status,
      actual_cost_usd = p_actual_cost_usd,
      input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      settled_at = v_now
  where id = v_call.id;

  v_day := (v_call.reserved_at at time zone 'UTC')::date;
  select * into v_usage
  from private.ai_usage_daily
  where day = v_day and provider = p_provider and model_id = p_model_id
  for update;
  if found then
    v_actual := coalesce(p_actual_cost_usd, case when p_status = 'unknown' then v_call.reserved_cost_usd else 0 end);
    update private.ai_usage_daily
    set reserved_cost_usd = greatest(0, reserved_cost_usd - v_call.reserved_cost_usd),
        estimated_cost_usd = estimated_cost_usd + v_actual,
        input_tokens = input_tokens + coalesce(p_input_tokens, 0),
        output_tokens = output_tokens + coalesce(p_output_tokens, 0),
        updated_at = v_now
    where day = v_day and provider = p_provider and model_id = p_model_id;
  end if;

  if p_status = 'completed'
     and jsonb_typeof(p_verdict) = 'object'
     and p_verdict->>'verdict' in ('accept', 'reject')
     and p_cache_key is not null
     and p_prompt_version is not null
     and p_policy_version is not null
  then
    insert into private.judgment_cache (
      cache_key, question_revision_id, normalized_answer,
      prompt_version, model_id, policy_version, verdict, expires_at, updated_at
    )
    values (
      p_cache_key, v_attempt.question_revision_id, v_attempt.normalized_answer,
      p_prompt_version, p_model_id, p_policy_version, p_verdict,
      v_now + interval '30 days', v_now
    )
    on conflict (cache_key) do update set
      verdict = excluded.verdict,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at;
  end if;
  return jsonb_build_object('status', p_status, 'callNo', p_call_no);
end;
$$;

revoke all on function public.server_reserve_ai_usage(uuid, uuid, uuid, text, text, numeric, numeric, integer) from public, anon, authenticated;
revoke all on function public.server_settle_ai_usage(uuid, uuid, uuid, smallint, text, text, text, jsonb, integer, integer, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public.server_reserve_ai_usage(uuid, uuid, uuid, text, text, numeric, numeric, integer) to service_role;
grant execute on function public.server_settle_ai_usage(uuid, uuid, uuid, smallint, text, text, text, jsonb, integer, integer, numeric, text, text, text) to service_role;
