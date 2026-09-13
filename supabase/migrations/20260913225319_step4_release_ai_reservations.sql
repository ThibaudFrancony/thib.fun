-- Étape 4 — libération durable des réservations IA expirées.
-- Cette migration complète les deux migrations précédentes sans les modifier.
-- Elle n'utilise ni Vault ni réseau : chaque réservation crée son propre job
-- privé et une annulation de job libère prudemment le coût réservé.

create or replace function private.reconcile_expired_ai_reservation(
  p_attempt_id uuid,
  p_call_no smallint
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_call private.ai_calls%rowtype;
  v_usage private.ai_usage_daily%rowtype;
  v_day date;
  v_now timestamptz := clock_timestamp();
begin
  if p_attempt_id is null or p_call_no not in (1, 2) then
    return null;
  end if;

  select * into v_call
  from private.ai_calls
  where attempt_id = p_attempt_id and call_no = p_call_no
  for update;
  if not found then
    return null;
  end if;
  if v_call.status <> 'reserved' then
    return v_call.status;
  end if;

  update private.ai_calls
  set status = 'unknown',
      actual_cost_usd = v_call.reserved_cost_usd,
      settled_at = v_now
  where id = v_call.id;

  v_day := (v_call.reserved_at at time zone 'UTC')::date;
  select * into v_usage
  from private.ai_usage_daily
  where day = v_day
    and provider = v_call.provider
    and model_id = v_call.model_id
  for update;
  if found then
    update private.ai_usage_daily
    set reserved_cost_usd = greatest(0, reserved_cost_usd - v_call.reserved_cost_usd),
        estimated_cost_usd = estimated_cost_usd + v_call.reserved_cost_usd,
        updated_at = v_now
    where day = v_day
      and provider = v_call.provider
      and model_id = v_call.model_id;
  end if;
  return 'released';
end;
$$;

create or replace function private.schedule_ai_reservation_release()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_match_id uuid;
  v_phase_id uuid;
begin
  select a.match_id, m.phase_id
  into v_match_id, v_phase_id
  from private.quiz_attempts as a
  join private.matches as m on m.id = a.match_id
  where a.id = new.attempt_id;
  if v_match_id is null or v_phase_id is null then
    return new;
  end if;

  insert into private.jobs (
    match_id, kind, phase_id, dedupe_key, payload, run_at, status
  )
  values (
    v_match_id,
    'release_ai_reservation',
    v_phase_id,
    v_match_id::text || ':' || new.attempt_id::text || ':release_ai:' || new.call_no::text,
    jsonb_build_object(
      'matchId', v_match_id,
      'attemptId', new.attempt_id,
      'callNo', new.call_no
    ),
    new.expires_at,
    'pending'
  )
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

drop trigger if exists ai_calls_schedule_reservation_release on private.ai_calls;
create trigger ai_calls_schedule_reservation_release
after insert on private.ai_calls
for each row
execute function private.schedule_ai_reservation_release();

create or replace function private.release_cancelled_ai_reservation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_attempt_id uuid;
  v_call_no smallint;
begin
  if old.status is distinct from 'cancelled' and new.status = 'cancelled' then
    v_attempt_id := private.try_uuid(new.payload->>'attemptId');
    if (new.payload->>'callNo') ~ '^[12]$' then
      v_call_no := (new.payload->>'callNo')::smallint;
      perform private.reconcile_expired_ai_reservation(v_attempt_id, v_call_no);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_release_cancelled_ai_reservation on private.jobs;
create trigger jobs_release_cancelled_ai_reservation
after update of status on private.jobs
for each row
when (new.kind = 'release_ai_reservation' and new.status = 'cancelled')
execute function private.release_cancelled_ai_reservation();

create or replace function public.server_release_ai_reservation(
  p_job_id uuid,
  p_lease_token uuid,
  p_attempt_id uuid,
  p_call_no smallint
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
  v_status text;
  v_now timestamptz := clock_timestamp();
begin
  if p_job_id is null or p_lease_token is null or p_attempt_id is null
     or p_call_no not in (1, 2)
  then
    raise exception 'INVALID_ENVELOPE';
  end if;

  -- Match puis job, comme les RPC de commit/réservation. Une transition de
  -- partie et une expiration ne peuvent donc pas libérer le même appel deux fois.
  select m.* into v_match
  from private.matches as m
  where m.id = (select j.match_id from private.jobs as j where j.id = p_job_id)
  for update;
  select j.* into v_job
  from private.jobs as j
  where j.id = p_job_id
  for update;
  if not found then
    raise exception 'JOB_NOT_FOUND';
  end if;
  if v_job.status in ('done', 'cancelled', 'failed') then
    return jsonb_build_object('status', v_job.status, 'callNo', p_call_no);
  end if;
  if v_match.id is null
     or v_job.kind <> 'release_ai_reservation'
     or v_job.match_id is distinct from v_match.id
     or v_job.status <> 'running'
     or v_job.lease_token is distinct from p_lease_token
     or v_job.lease_until is null
     or v_job.lease_until <= v_now
     or v_job.payload->>'matchId' is distinct from v_match.id::text
     or v_job.payload->>'attemptId' is distinct from p_attempt_id::text
     or v_job.payload->>'callNo' is distinct from p_call_no::text
  then
    raise exception 'JOB_LEASE_INVALID';
  end if;

  select * into v_attempt
  from private.quiz_attempts as a
  where a.id = p_attempt_id and a.match_id = v_match.id
  for update;
  if not found then
    raise exception 'ATTEMPT_NOT_FOUND';
  end if;
  select * into v_call
  from private.ai_calls as c
  where c.attempt_id = p_attempt_id and c.call_no = p_call_no
  for update;
  if not found then
    raise exception 'AI_CALL_NOT_FOUND';
  end if;

  v_status := private.reconcile_expired_ai_reservation(p_attempt_id, p_call_no);
  update private.jobs
  set status = 'done',
      completed_at = v_now,
      lease_token = null,
      lease_until = null,
      last_error_code = null
  where id = v_job.id;
  return jsonb_build_object(
    'status', coalesce(v_status, v_call.status),
    'callNo', p_call_no
  );
end;
$$;

revoke all on function private.reconcile_expired_ai_reservation(uuid, smallint) from public, anon, authenticated;
revoke all on function private.schedule_ai_reservation_release() from public, anon, authenticated;
revoke all on function private.release_cancelled_ai_reservation() from public, anon, authenticated;
revoke all on function public.server_release_ai_reservation(uuid, uuid, uuid, smallint) from public, anon, authenticated;
grant execute on function public.server_release_ai_reservation(uuid, uuid, uuid, smallint) to service_role;
