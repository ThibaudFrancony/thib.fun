-- tibo.fun — étape 4 : dispatcher minimal et jugements quiz persistants.
--
-- Cette migration est additive. Elle ne lit ni n'écrit Vault et ne modifie
-- aucune migration déjà appliquée. Les appels ci-dessous sont réservés au
-- rôle serveur ; le navigateur ne peut ni réserver un appel IA ni lire une
-- tentative complète.

create table if not exists private.quiz_attempts (
  id uuid primary key,
  match_id uuid not null references private.matches (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete restrict,
  phase_id uuid not null,
  question_revision_id uuid references private.content_items (id) on delete restrict,
  -- Le runtime de production reçoit un UUID de content_items. Ce champ garde
  -- aussi la clé de fixture quand le pack local vient d'un fichier.
  question_item_key text not null,
  raw_answer text not null check (char_length(raw_answer) <= 240),
  normalized_answer text not null check (char_length(normalized_answer) <= 240),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'ambiguous', 'void')),
  method text check (method is null or method in ('exact', 'alias', 'numeric', 'llm', 'opponent', 'timeout')),
  reason_code text,
  submitted_at timestamptz not null,
  resolved_at timestamptz,
  model_id text,
  prompt_version text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default now(),
  constraint quiz_attempts_phase_player_unique unique (match_id, phase_id, player_id)
);

create index if not exists quiz_attempts_match_idx
  on private.quiz_attempts (match_id, submitted_at desc);

create table if not exists private.judgment_cache (
  cache_key text primary key,
  question_revision_id uuid references private.content_items (id) on delete restrict,
  normalized_answer text not null check (char_length(normalized_answer) <= 240),
  prompt_version text not null,
  model_id text not null,
  policy_version text not null,
  verdict jsonb not null check (
    jsonb_typeof(verdict) = 'object'
    and verdict->>'verdict' in ('accept', 'reject')
  ),
  expires_at timestamptz not null,
  hit_count bigint not null default 0 check (hit_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists judgment_cache_expiry_idx
  on private.judgment_cache (expires_at);

create table if not exists private.ai_usage_daily (
  day date not null,
  provider text not null,
  model_id text not null,
  calls integer not null default 0 check (calls >= 0),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  estimated_cost_usd numeric(14, 6) not null default 0 check (estimated_cost_usd >= 0),
  reserved_cost_usd numeric(14, 6) not null default 0 check (reserved_cost_usd >= 0),
  price_revision text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (day, provider, model_id)
);

create table if not exists private.ai_calls (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references private.quiz_attempts (id) on delete cascade,
  call_no smallint not null check (call_no in (1, 2)),
  provider text not null,
  model_id text not null,
  status text not null check (status in ('reserved', 'completed', 'failed', 'unknown')),
  reserved_cost_usd numeric(14, 6) not null default 0 check (reserved_cost_usd >= 0),
  actual_cost_usd numeric(14, 6) check (actual_cost_usd is null or actual_cost_usd >= 0),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  reserved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  settled_at timestamptz,
  unique (attempt_id, call_no)
);

create index if not exists ai_calls_reserved_expiry_idx
  on private.ai_calls (expires_at)
  where status = 'reserved';

create table if not exists private.ai_job_budgets (
  job_id uuid primary key references private.jobs (id) on delete cascade,
  match_id uuid not null references private.matches (id) on delete cascade,
  max_attempts smallint not null default 2 check (max_attempts between 1 and 2),
  attempts_reserved smallint not null default 0 check (attempts_reserved between 0 and 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_job_budgets_job_match_unique unique (job_id, match_id)
);

create index if not exists ai_job_budgets_match_idx
  on private.ai_job_budgets (match_id, updated_at desc);

create or replace function private.try_uuid(p_value text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;
  return p_value::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function private.ensure_ai_job_budget()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.kind = 'judge_answer' and new.match_id is not null then
    insert into private.ai_job_budgets (job_id, match_id)
    values (new.id, new.match_id)
    on conflict (job_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_create_ai_budget on private.jobs;
create trigger jobs_create_ai_budget
after insert on private.jobs
for each row execute function private.ensure_ai_job_budget();

create or replace function private.sync_quiz_attempt_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_match private.matches%rowtype;
  v_attempt jsonb;
  v_attempt_id uuid;
  v_player_id uuid;
  v_phase_id uuid;
  v_question_revision_id uuid;
  v_seat integer;
  v_submitted_at timestamptz;
  v_status text;
  v_method text;
  v_reason text;
begin
  if new.event_type not in (
    'ANSWER_SUBMITTED', 'ANSWER_TIMED_OUT', 'JUDGMENT_RECEIVED',
    'QUESTION_REPLACED', 'JUDGING_UNAVAILABLE'
  ) then
    return new;
  end if;

  select * into v_match
  from private.matches as m
  where m.id = new.match_id;
  if not found then
    return new;
  end if;

  v_attempt := coalesce(v_match.state->'currentAttempt', '{}'::jsonb);
  v_attempt_id := private.try_uuid(coalesce(new.payload->>'attemptId', v_attempt->>'id'));
  if v_attempt_id is null then
    -- Les fixtures fichier peuvent utiliser des clés lisibles qui ne sont
    -- pas des UUID. Elles restent dans match_events ; les tentatives de
    -- production, elles, utilisent les phase UUID du moteur.
    return new;
  end if;

  if new.event_type in ('ANSWER_SUBMITTED', 'ANSWER_TIMED_OUT') then
    begin
      v_seat := (v_attempt->>'seat')::integer;
      v_submitted_at := coalesce(nullif(v_attempt->>'submittedAt', '')::timestamptz, new.created_at);
    exception
      when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
        return new;
    end;
    if v_seat not in (0, 1) then
      return new;
    end if;
    select mp.user_id
    into v_player_id
    from private.match_players as mp
    where mp.match_id = new.match_id
      and mp.seat = v_seat;
    if v_player_id is null then
      return new;
    end if;
    v_phase_id := coalesce(
      private.try_uuid(new.payload->>'phaseId'),
      private.try_uuid(v_attempt->>'id'),
      v_match.phase_id
    );
    select ci.id
    into v_question_revision_id
    from private.content_items as ci
    where ci.id = private.try_uuid(v_attempt->>'questionItemId');
    insert into private.quiz_attempts (
      id, match_id, player_id, phase_id, question_revision_id,
      question_item_key, raw_answer, normalized_answer, status, method,
      reason_code, submitted_at, resolved_at
    )
    values (
      v_attempt_id,
      new.match_id,
      v_player_id,
      v_phase_id,
      v_question_revision_id,
      coalesce(v_attempt->>'questionItemId', ''),
      coalesce(v_attempt->>'rawAnswer', ''),
      coalesce(v_attempt->>'normalizedAnswer', ''),
      case when new.event_type = 'ANSWER_TIMED_OUT' then 'rejected' else 'pending' end,
      case when new.event_type = 'ANSWER_TIMED_OUT' then 'timeout' else null end,
      case when new.event_type = 'ANSWER_TIMED_OUT' then 'timeout' else null end,
      v_submitted_at,
      case when new.event_type = 'ANSWER_TIMED_OUT' then new.created_at else null end
    )
    on conflict (id) do nothing;
    return new;
  end if;

  if new.event_type = 'JUDGMENT_RECEIVED' then
    v_status := case new.payload->>'verdict'
      when 'accept' then 'accepted'
      when 'reject' then 'rejected'
      else 'ambiguous'
    end;
    v_method := nullif(new.payload->>'method', '');
    v_reason := nullif(new.payload->>'reasonCode', '');
    v_phase_id := private.try_uuid(new.payload->>'phaseId');
    update private.quiz_attempts
    set status = v_status,
        method = case when v_method in ('exact', 'alias', 'numeric', 'llm', 'opponent', 'timeout') then v_method else null end,
        reason_code = v_reason,
        resolved_at = new.created_at,
        model_id = nullif(new.payload->>'modelId', ''),
        prompt_version = nullif(new.payload->>'promptVersion', ''),
        latency_ms = case when (new.payload->>'latencyMs') ~ '^[0-9]+$' then (new.payload->>'latencyMs')::integer else latency_ms end
    where id = v_attempt_id
      and match_id = new.match_id
      and (v_phase_id is null or phase_id = v_phase_id);
  elsif new.event_type = 'QUESTION_REPLACED' then
    update private.quiz_attempts
    set status = 'void',
        reason_code = coalesce(nullif(new.payload->>'reasonCode', ''), 'ambiguous'),
        resolved_at = new.created_at
    where id = v_attempt_id and match_id = new.match_id;
  elsif new.event_type = 'JUDGING_UNAVAILABLE' then
    update private.quiz_attempts
    set status = 'void', reason_code = 'judging_unavailable', resolved_at = new.created_at
    where id = v_attempt_id and match_id = new.match_id;
  end if;
  return new;
end;
$$;

drop trigger if exists match_events_sync_quiz_attempt on private.match_events;
create trigger match_events_sync_quiz_attempt
after insert on private.match_events
for each row execute function private.sync_quiz_attempt_event();

create or replace function public.server_prepare_quiz_judgment(
  p_job_id uuid,
  p_lease_token uuid,
  p_attempt_id uuid,
  p_cache_key text,
  p_model_id text,
  p_prompt_version text,
  p_policy_version text
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
  v_cache private.judgment_cache%rowtype;
  v_budget private.ai_job_budgets%rowtype;
  v_now timestamptz;
begin
  if p_job_id is null or p_lease_token is null or p_attempt_id is null
     or p_cache_key is null or btrim(p_cache_key) = ''
     or p_model_id is null or btrim(p_model_id) = ''
     or p_prompt_version is null or p_policy_version is null
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
  from private.quiz_attempts as a
  where a.id = p_attempt_id and a.match_id = v_match.id
  for update;
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  if v_attempt.phase_id is distinct from v_match.phase_id then
    raise exception 'STALE_JOB';
  end if;

  select * into v_cache
  from private.judgment_cache as c
  where c.cache_key = p_cache_key
    and c.expires_at > v_now
    and c.question_revision_id is not distinct from v_attempt.question_revision_id
    and c.normalized_answer = v_attempt.normalized_answer
    and c.prompt_version = p_prompt_version
    and c.model_id = p_model_id
    and c.policy_version = p_policy_version
    and c.verdict->>'verdict' in ('accept', 'reject')
  for update;
  if found then
    update private.judgment_cache
    set hit_count = hit_count + 1, updated_at = v_now
    where cache_key = v_cache.cache_key;
    return jsonb_build_object('status', 'cache_hit', 'verdict', v_cache.verdict);
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
  return jsonb_build_object(
    'status', 'ready',
    'attemptsReserved', v_budget.attempts_reserved,
    'maxAttempts', v_budget.max_attempts
  );
end;
$$;

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
  select * into v_attempt from private.quiz_attempts where id = p_attempt_id and match_id = v_match.id for update;
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;

  insert into private.ai_job_budgets (job_id, match_id)
  values (v_job.id, v_match.id)
  on conflict (job_id) do nothing;
  select * into v_budget from private.ai_job_budgets where job_id = v_job.id for update;
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
  select * into v_attempt from private.quiz_attempts where id = p_attempt_id and match_id = v_match.id for update;
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  select * into v_call
  from private.ai_calls
  where attempt_id = p_attempt_id and call_no = p_call_no
  for update;
  if not found then raise exception 'AI_CALL_NOT_FOUND'; end if;
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

revoke all on function private.try_uuid(text) from public, anon, authenticated;
revoke all on function private.ensure_ai_job_budget() from public, anon, authenticated;
revoke all on function private.sync_quiz_attempt_event() from public, anon, authenticated;
revoke all on function public.server_prepare_quiz_judgment(uuid, uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.server_reserve_ai_usage(uuid, uuid, uuid, text, text, numeric, numeric, integer) from public, anon, authenticated;
revoke all on function public.server_settle_ai_usage(uuid, uuid, uuid, smallint, text, text, text, jsonb, integer, integer, numeric, text, text, text) from public, anon, authenticated;

grant execute on function public.server_prepare_quiz_judgment(uuid, uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.server_reserve_ai_usage(uuid, uuid, uuid, text, text, numeric, numeric, integer) to service_role;
grant execute on function public.server_settle_ai_usage(uuid, uuid, uuid, smallint, text, text, text, jsonb, integer, integer, numeric, text, text, text) to service_role;
grant all on private.quiz_attempts, private.judgment_cache, private.ai_usage_daily, private.ai_calls, private.ai_job_budgets to service_role;
