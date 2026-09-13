-- tibo.fun — étape 3 : commit transactionnel et reprise des jobs.
--
-- Cette migration est additive. La migration 20260909185440 est déjà
-- appliquée sur certains environnements et reste donc immuable.

create or replace function private.record_match_result(
  p_match_id uuid,
  p_match_row private.matches,
  p_result jsonb,
  p_completed_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_game_kind text;
  v_result_kind text;
  v_result_outcome text;
  v_reason text;
  v_result_players jsonb;
  v_winner uuid;
  v_shared_score numeric;
  v_result_player jsonb;
  v_index integer;
  v_user_id uuid;
  v_score numeric;
  v_metrics jsonb;
  v_player_outcome text;
  v_history_outcome text;
  v_opponent uuid;
  v_inserted integer;
  v_completed_at timestamptz := coalesce(p_completed_at, clock_timestamp());
begin
  if p_result is null or jsonb_typeof(p_result) = 'null' then
    return false;
  end if;
  if jsonb_typeof(p_result) is distinct from 'object' then
    raise exception 'INVALID_RESULT';
  end if;

  select g.kind
  into v_game_kind
  from public.games as g
  where g.slug = p_match_row.game_slug;
  if v_game_kind is null then
    raise exception 'INVALID_RESULT';
  end if;

  v_result_kind := p_result->>'kind';
  v_result_outcome := p_result->>'outcome';
  v_reason := p_result->>'reason';
  v_result_players := p_result->'players';
  if v_result_kind is null
     or v_result_kind <> v_game_kind
     or v_result_outcome is null
     or v_result_outcome not in ('win', 'draw', 'cooperative', 'abandoned')
     or v_reason is null
     or v_reason not in (
       'normal', 'round_limit', 'turn_limit', 'blocked',
       'dictionary_exhausted', 'resign', 'claimed_forfeit',
       'absence', 'judging_unavailable', 'technical_error'
     )
     or jsonb_typeof(p_result->'summary') is distinct from 'object'
     or jsonb_typeof(v_result_players) is distinct from 'array'
     or jsonb_array_length(v_result_players) <> 2
  then
    raise exception 'INVALID_RESULT';
  end if;

  if v_game_kind = 'cooperative'
     and v_result_outcome not in ('cooperative', 'abandoned')
  then
    raise exception 'INVALID_RESULT';
  end if;
  if v_game_kind = 'competitive'
     and v_result_outcome = 'cooperative'
  then
    raise exception 'INVALID_RESULT';
  end if;

  begin
    v_winner := nullif(p_result->>'winnerId', '')::uuid;
    v_shared_score := nullif(p_result->>'sharedScore', '')::numeric;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'INVALID_RESULT';
  end;

  if (v_result_outcome = 'win' and v_winner is null)
     or (v_result_outcome <> 'win' and v_winner is not null)
     or (v_game_kind = 'competitive' and v_shared_score is not null)
     or (v_game_kind = 'cooperative' and v_result_outcome <> 'abandoned' and v_shared_score is null)
  then
    raise exception 'INVALID_RESULT';
  end if;
  if v_winner is not null
     and not exists (
       select 1
       from private.match_players as mp
       where mp.match_id = p_match_id
         and mp.user_id = v_winner
     )
  then
    raise exception 'INVALID_RESULT';
  end if;
  if (select count(*) from private.match_players as mp where mp.match_id = p_match_id) <> 2 then
    raise exception 'INVALID_MATCH_PLAYERS';
  end if;

  -- The result is the idempotency boundary. Nothing below this INSERT may
  -- update counters unless this transaction created the match result row.
  insert into private.match_results (
    match_id, kind, outcome, winner_id, shared_score, summary, reason, completed_at
  )
  values (
    p_match_id,
    v_result_kind,
    v_result_outcome,
    v_winner,
    v_shared_score,
    p_result->'summary',
    v_reason,
    v_completed_at
  )
  on conflict (match_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted <> 1 then
    return false;
  end if;

  for v_index in 0..1 loop
    v_result_player := v_result_players->v_index;
    if jsonb_typeof(v_result_player) is distinct from 'object' then
      raise exception 'INVALID_RESULT';
    end if;
    begin
      v_user_id := (v_result_player->>'userId')::uuid;
      v_score := nullif(v_result_player->>'score', '')::numeric;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'INVALID_RESULT';
    end;
    v_metrics := coalesce(v_result_player->'metrics', '{}'::jsonb);
    if jsonb_typeof(v_metrics) is distinct from 'object'
       or not exists (
         select 1
         from private.match_players as mp
         where mp.match_id = p_match_id
           and mp.seat = v_index
           and mp.user_id = v_user_id
       )
    then
      raise exception 'INVALID_RESULT';
    end if;

    v_player_outcome := case
      when v_result_outcome = 'abandoned' then 'abandoned'
      when v_result_outcome = 'draw' then 'draw'
      when v_result_outcome = 'cooperative' then 'cooperative'
      when v_winner = v_user_id then 'win'
      else 'loss'
    end;

    insert into private.player_results (match_id, user_id, outcome, score, metrics)
    values (p_match_id, v_user_id, v_player_outcome, v_score, v_metrics)
    on conflict (match_id, user_id) do nothing;

    insert into public.player_game_stats (
      user_id, game_slug, played, wins, losses, draws, cooperative, abandoned, metrics
    )
    values (
      v_user_id,
      p_match_row.game_slug,
      case when v_player_outcome in ('win', 'loss', 'draw', 'cooperative') then 1 else 0 end,
      case when v_player_outcome = 'win' then 1 else 0 end,
      case when v_player_outcome = 'loss' then 1 else 0 end,
      case when v_player_outcome = 'draw' then 1 else 0 end,
      case when v_player_outcome = 'cooperative' then 1 else 0 end,
      case when v_player_outcome = 'abandoned' then 1 else 0 end,
      v_metrics
    )
    on conflict (user_id, game_slug) do update set
      played = public.player_game_stats.played + excluded.played,
      wins = public.player_game_stats.wins + excluded.wins,
      losses = public.player_game_stats.losses + excluded.losses,
      draws = public.player_game_stats.draws + excluded.draws,
      cooperative = public.player_game_stats.cooperative + excluded.cooperative,
      abandoned = public.player_game_stats.abandoned + excluded.abandoned,
      metrics = public.player_game_stats.metrics || excluded.metrics,
      updated_at = v_completed_at;
  end loop;

  for v_index in 0..1 loop
    select mp.user_id
    into v_user_id
    from private.match_players as mp
    where mp.match_id = p_match_id
      and mp.seat = v_index;
    select mp.user_id
    into v_opponent
    from private.match_players as mp
    where mp.match_id = p_match_id
      and mp.seat = 1 - v_index;

    v_result_player := v_result_players->v_index;
    v_score := nullif(v_result_player->>'score', '')::numeric;
    v_history_outcome := case
      when v_result_outcome = 'abandoned' then 'abandoned'
      when v_result_outcome = 'draw' then 'draw'
      when v_result_outcome = 'cooperative' then 'cooperative'
      when v_winner = v_user_id then 'win'
      else 'loss'
    end;

    insert into public.history_entries (
      viewer_id, match_id, opponent_id, game_slug, started_at, ended_at,
      outcome, score, opponent_score, shared_score, payload
    )
    values (
      v_user_id,
      p_match_id,
      v_opponent,
      p_match_row.game_slug,
      p_match_row.started_at,
      v_completed_at,
      v_history_outcome,
      v_score,
      nullif((v_result_players->(1 - v_index)->>'score'), '')::numeric,
      v_shared_score,
      jsonb_build_object(
        'summary', p_result->'summary',
        'reason', v_reason,
        'players', coalesce((
          select jsonb_agg(jsonb_build_object(
            'userId', mp.user_id,
            'pseudo', mp.pseudo_snapshot,
            'score', nullif((v_result_players->(mp.seat::integer)->>'score'), '')::numeric,
            'metrics', coalesce(v_result_players->(mp.seat::integer)->'metrics', '{}'::jsonb)
          ) order by mp.seat)
          from private.match_players as mp
          where mp.match_id = p_match_id
        ), '[]'::jsonb)
      )
    )
    on conflict (viewer_id, match_id) do nothing;
  end loop;

  -- Cooperative pair statistics are maintained by the game-specific result
  -- triggers installed by the content migrations. Competitive results remain
  -- owned by this common finalizer.
  if v_result_kind = 'competitive' then
    insert into private.pair_game_stats (
      player_low, player_high, game_slug, played, low_wins, high_wins,
      draws, cooperative, abandoned, metrics
    )
    select
      least(mp0.user_id, mp1.user_id),
      greatest(mp0.user_id, mp1.user_id),
      p_match_row.game_slug,
      case when v_result_outcome in ('win', 'draw') then 1 else 0 end,
      case when v_result_outcome = 'win' and v_winner = least(mp0.user_id, mp1.user_id) then 1 else 0 end,
      case when v_result_outcome = 'win' and v_winner = greatest(mp0.user_id, mp1.user_id) then 1 else 0 end,
      case when v_result_outcome = 'draw' then 1 else 0 end,
      0,
      case when v_result_outcome = 'abandoned' then 1 else 0 end,
      p_result->'summary'
    from (select user_id from private.match_players where match_id = p_match_id and seat = 0) as mp0,
         (select user_id from private.match_players where match_id = p_match_id and seat = 1) as mp1
    on conflict (player_low, player_high, game_slug) do update set
      played = private.pair_game_stats.played + excluded.played,
      low_wins = private.pair_game_stats.low_wins + excluded.low_wins,
      high_wins = private.pair_game_stats.high_wins + excluded.high_wins,
      draws = private.pair_game_stats.draws + excluded.draws,
      abandoned = private.pair_game_stats.abandoned + excluded.abandoned,
      metrics = private.pair_game_stats.metrics || excluded.metrics,
      updated_at = v_completed_at;
  end if;

  update private.room_members
  set ready = false
  where room_id = p_match_row.room_id;
  update private.rooms
  set status = 'waiting',
      current_match_id = null,
      version = version + 1
  where id = p_match_row.room_id;
  perform private.refresh_room_views(p_match_row.room_id);

  return true;
end;
$$;

create or replace function private.finalize_match_technical_error(
  p_match_id uuid,
  p_match_row private.matches,
  p_job_id uuid,
  p_error_code text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_game_kind text;
  v_result jsonb;
  v_safe_result jsonb;
  v_payload jsonb;
  v_viewer_id uuid;
  v_new_version bigint := p_match_row.version + 1;
  v_result_inserted boolean;
begin
  select g.kind
  into v_game_kind
  from public.games as g
  where g.slug = p_match_row.game_slug;
  if v_game_kind is null then
    raise exception 'INVALID_RESULT';
  end if;

  v_result := jsonb_build_object(
    'kind', v_game_kind,
    'outcome', 'abandoned',
    'winnerId', null,
    'sharedScore', null,
    'reason', 'technical_error',
    'summary', jsonb_build_object('type', 'technical_error'),
    'players', jsonb_build_array(
      jsonb_build_object(
        'userId', (select mp.user_id from private.match_players as mp where mp.match_id = p_match_id and mp.seat = 0),
        'score', null,
        'metrics', '{}'::jsonb
      ),
      jsonb_build_object(
        'userId', (select mp.user_id from private.match_players as mp where mp.match_id = p_match_id and mp.seat = 1),
        'score', null,
        'metrics', '{}'::jsonb
      )
    )
  );
  v_result_inserted := private.record_match_result(p_match_id, p_match_row, v_result, p_now);

  update private.matches
  set state = p_match_row.state,
      version = v_new_version,
      phase_id = extensions.gen_random_uuid(),
      deadline_at = null,
      deadline_kind = null,
      status = 'abandoned',
      ended_at = p_now,
      end_reason = 'technical_error'
  where id = p_match_id;

  -- A terminal match invalidates every still runnable job. The ordinary
  -- transition path below only cancels explicit IDs from jobsToCancel.
  update private.jobs
  set status = 'cancelled',
      completed_at = p_now,
      lease_token = null,
      lease_until = null
  where match_id = p_match_id
    and status in ('pending', 'running')
    and (p_job_id is null or id <> p_job_id);

  insert into private.match_events (match_id, version, event_type, actor_id, payload)
  values (
    p_match_id,
    v_new_version,
    'MATCH_TECHNICAL_ERROR',
    null,
    jsonb_build_object('reason', 'technical_error')
  );

  v_safe_result := jsonb_build_object(
    'outcome', 'abandoned',
    'winnerId', null,
    'sharedScore', null,
    'reason', 'technical_error'
  );
  for v_viewer_id in
    select mp.user_id
    from private.match_players as mp
    where mp.match_id = p_match_id
    order by mp.seat
  loop
    select coalesce(mv.payload, '{}'::jsonb)
    into v_payload
    from public.match_views as mv
    where mv.match_id = p_match_id
      and mv.viewer_id = v_viewer_id;
    v_payload := coalesce(v_payload, '{}'::jsonb);
    v_payload := jsonb_set(v_payload, '{status}', to_jsonb('abandoned'::text), true);
    v_payload := jsonb_set(v_payload, '{deadlineAt}', 'null'::jsonb, true);
    v_payload := jsonb_set(v_payload, '{deadlineKind}', 'null'::jsonb, true);
    v_payload := jsonb_set(v_payload, '{allowedActions}', '[]'::jsonb, true);
    v_payload := jsonb_set(v_payload, '{result}', v_safe_result, true);
    insert into public.match_views (match_id, viewer_id, version, payload, updated_at)
    values (p_match_id, v_viewer_id, v_new_version, v_payload, p_now)
    on conflict (match_id, viewer_id) do update set
      version = excluded.version,
      payload = excluded.payload,
      updated_at = excluded.updated_at;
  end loop;

  return jsonb_build_object(
    'matchId', p_match_id,
    'version', v_new_version,
    'status', 'abandoned',
    'reason', 'technical_error',
    'resultInserted', v_result_inserted
  );
end;
$$;

create or replace function private.claim_due_jobs(p_limit integer default 4)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_jobs jsonb;
begin
  with due as (
    select j.id
    from private.jobs as j
    where (
      (j.status = 'pending' and j.run_at <= v_now and j.attempts < 5)
      or (j.status = 'running' and j.lease_until <= v_now)
    )
    order by j.run_at, j.id
    for update skip locked
    limit least(greatest(coalesce(p_limit, 4), 1), 4)
  ),
  claimed as (
    update private.jobs as j
    set status = 'running',
        attempts = j.attempts + 1,
        lease_token = extensions.gen_random_uuid(),
        lease_until = v_now + interval '30 seconds',
        last_error_code = null
    from due
    where j.id = due.id
    returning j.id, j.lease_token, j.run_at
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'jobId', id,
    'leaseToken', lease_token
  ) order by run_at, id), '[]'::jsonb)
  into v_jobs
  from claimed;
  return v_jobs;
end;
$$;

create or replace function private.dispatch_due_jobs()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_worker_origin text;
  v_worker_secret text;
  v_jobs jsonb;
  v_request_id bigint;
begin
  select decrypted_secret into v_worker_origin
  from vault.decrypted_secrets
  where name = 'worker_origin'
  limit 1;
  select decrypted_secret into v_worker_secret
  from vault.decrypted_secrets
  where name = 'internal_job_secret'
  limit 1;
  if v_worker_origin is null or v_worker_secret is null then
    return jsonb_build_object('dispatched', false, 'reason', 'WORKER_CONFIGURATION_MISSING');
  end if;

  v_jobs := private.claim_due_jobs(4);
  if jsonb_array_length(v_jobs) = 0 then
    return jsonb_build_object('dispatched', false, 'reason', 'NO_DUE_JOBS');
  end if;

  select net.http_post(
    url := rtrim(v_worker_origin, '/') || '/api/internal/jobs/run',
    body := jsonb_build_object('jobs', v_jobs),
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-internal-job-secret', v_worker_secret
    ),
    timeout_milliseconds := 25000
  )
  into v_request_id;
  return jsonb_build_object(
    'dispatched', true,
    'count', jsonb_array_length(v_jobs),
    'requestId', v_request_id
  );
exception
  when undefined_table or undefined_function then
    return jsonb_build_object('dispatched', false, 'reason', 'DISPATCH_EXTENSION_UNAVAILABLE');
end;
$$;

create or replace function public.server_set_room_ready(
  p_actor uuid,
  p_command_id uuid,
  p_room_id uuid,
  p_expected_version bigint,
  p_ready boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room private.rooms%rowtype;
  v_existing jsonb;
  v_receipt_actor uuid;
  v_receipt_type text;
  v_receipt_hash text;
  v_expected_hash text := encode(extensions.digest(convert_to(p_ready::text, 'UTF8'), 'sha256'), 'hex');
  v_version bigint;
  v_now timestamptz;
begin
  if p_actor is null
     or p_command_id is null
     or p_room_id is null
     or p_expected_version is null
     or p_expected_version < 0
     or p_ready is null
  then
    raise exception 'INVALID_ENVELOPE';
  end if;
  select * into v_room
  from private.rooms
  where id = p_room_id
  for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  v_now := clock_timestamp();

  select actor_id, action_type, payload_hash, response
  into v_receipt_actor, v_receipt_type, v_receipt_hash, v_existing
  from private.room_command_receipts
  where room_id = p_room_id
    and command_id = p_command_id;
  if found then
    if v_receipt_actor is distinct from p_actor
       or v_receipt_type is distinct from 'SET_READY'
       or v_receipt_hash is distinct from v_expected_hash
    then
      raise exception 'COMMAND_ID_REUSED';
    end if;
    return v_existing;
  end if;

  if not exists (
    select 1 from private.room_members
    where room_id = p_room_id and user_id = p_actor
  ) then
    raise exception 'NOT_A_ROOM_MEMBER';
  end if;
  if v_room.status <> 'waiting' then
    raise exception 'ROOM_NOT_WAITING';
  end if;
  if v_room.version <> p_expected_version then
    raise exception 'VERSION_CONFLICT';
  end if;

  update private.room_members
  set ready = p_ready, last_seen_at = v_now
  where room_id = p_room_id and user_id = p_actor;
  update private.rooms
  set version = version + 1
  where id = p_room_id
  returning version into v_version;
  perform private.refresh_room_views(p_room_id);

  v_existing := jsonb_build_object(
    'roomId', p_room_id,
    'version', v_version,
    'ready', p_ready
  );
  insert into private.room_command_receipts (
    room_id, command_id, actor_id, action_type, payload_hash, committed_version, response
  )
  values (
    p_room_id, p_command_id, p_actor, 'SET_READY', v_expected_hash, v_version, v_existing
  );
  return v_existing;
end;
$$;

create or replace function public.server_finish_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_status text,
  p_error_code text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job private.jobs%rowtype;
  v_match private.matches%rowtype;
  v_now timestamptz;
begin
  if p_status not in ('done', 'cancelled') then
    raise exception 'INVALID_JOB_STATUS';
  end if;
  -- The match lock is needed because finishing an absence observation may
  -- schedule another job. Keep the same match-then-job order as commits and
  -- failures so a terminal transition cannot race that scheduling decision.
  select m.*
  into v_match
  from private.matches as m
  where m.id = (
    select j.match_id
    from private.jobs as j
    where j.id = p_job_id
  )
  for update;
  select * into v_job
  from private.jobs
  where id = p_job_id
  for update;
  if not found then
    raise exception 'JOB_NOT_FOUND';
  end if;
  if v_job.status in ('done', 'cancelled', 'failed') then
    return jsonb_build_object('jobId', v_job.id, 'status', v_job.status);
  end if;
  v_now := clock_timestamp();
  if v_job.status <> 'running'
     or v_job.lease_token is distinct from p_lease_token
     or v_job.lease_until <= v_now
  then
    raise exception 'JOB_LEASE_INVALID';
  end if;

  update private.jobs
  set status = p_status,
      last_error_code = p_error_code,
      completed_at = v_now,
      lease_token = null,
      lease_until = null
  where id = p_job_id;

  if p_status = 'done'
     and v_job.kind = 'check_absence'
     and v_job.match_id is not null
     and exists (
       select 1 from private.matches as m
       where m.id = v_job.match_id and m.status = 'active'
     )
     and not exists (
       select 1
       from private.jobs as next_job
       where next_job.match_id = v_job.match_id
         and next_job.kind = 'check_absence'
         and next_job.status in ('pending', 'running')
         and next_job.id <> v_job.id
     )
  then
    insert into private.jobs (
      match_id, kind, phase_id, dedupe_key, payload, run_at, status
    )
    values (
      v_job.match_id,
      'check_absence',
      null,
      v_job.id::text || ':next',
      jsonb_build_object('matchId', v_job.match_id, 'kind', 'check_absence'),
      v_now + interval '30 seconds',
      'pending'
    )
    on conflict (dedupe_key) do nothing;
  end if;
  return jsonb_build_object('jobId', p_job_id, 'status', p_status);
end;
$$;

create or replace function public.server_fail_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_error_code text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job private.jobs%rowtype;
  v_match private.matches%rowtype;
  v_next_status text;
  v_next_run_at timestamptz;
  v_now timestamptz;
  v_technical_result jsonb;
begin
  -- Match then job is the same lock order as server_commit_match. It avoids
  -- a commit/failure deadlock when both paths target one match.
  select m.*
  into v_match
  from private.matches as m
  where m.id = (
    select j.match_id from private.jobs as j where j.id = p_job_id
  )
  for update;

  select * into v_job
  from private.jobs
  where id = p_job_id
  for update;
  if not found then
    raise exception 'JOB_NOT_FOUND';
  end if;
  if v_job.status in ('done', 'cancelled', 'failed') then
    return jsonb_build_object('jobId', v_job.id, 'status', v_job.status, 'terminal', true);
  end if;
  v_now := clock_timestamp();
  if v_job.status <> 'running'
     or v_job.lease_token is distinct from p_lease_token
     or v_job.lease_until <= v_now
  then
    raise exception 'JOB_LEASE_INVALID';
  end if;

  if v_job.attempts >= 5 then
    if v_match.id is not null and v_match.status = 'active' then
      v_technical_result := private.finalize_match_technical_error(
        v_match.id, v_match, v_job.id, left(coalesce(p_error_code, 'WORKER_ERROR'), 120), v_now
      );
    end if;
    update private.jobs
    set status = 'failed',
        run_at = v_job.run_at,
        last_error_code = left(coalesce(p_error_code, 'WORKER_ERROR'), 120),
        completed_at = v_now,
        lease_token = null,
        lease_until = null
    where id = v_job.id;
    return jsonb_build_object(
      'jobId', v_job.id,
      'status', 'failed',
      'terminal', true,
      'match', coalesce(v_technical_result, '{}'::jsonb)
    );
  end if;

  v_next_status := 'pending';
  v_next_run_at := v_now + case v_job.attempts
    when 1 then interval '1 second'
    when 2 then interval '2 seconds'
    when 3 then interval '4 seconds'
    else interval '8 seconds'
  end;
  update private.jobs
  set status = v_next_status,
      run_at = v_next_run_at,
      last_error_code = left(coalesce(p_error_code, 'WORKER_ERROR'), 120),
      completed_at = null,
      lease_token = null,
      lease_until = null
  where id = v_job.id;
  return jsonb_build_object(
    'jobId', v_job.id,
    'status', v_next_status,
    'terminal', false,
    'runAt', v_next_run_at
  );
end;
$$;

create or replace function public.server_commit_match(p_envelope jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_match private.matches%rowtype;
  v_current_job private.jobs%rowtype;
  v_match_id uuid;
  v_actor_id uuid;
  v_command_id uuid;
  v_job_id uuid;
  v_lease_token uuid;
  v_source text;
  v_command_type text;
  v_command_hash text;
  v_expected_version bigint;
  v_previous_phase_id uuid;
  v_new_phase_id uuid;
  v_new_version bigint;
  v_match_kind text;
  v_actor_seat smallint;
  v_existing jsonb;
  v_receipt_actor uuid;
  v_receipt_type text;
  v_receipt_hash text;
  v_next jsonb;
  v_state jsonb;
  v_result jsonb;
  v_event jsonb;
  v_view_item jsonb;
  v_job_item jsonb;
  v_record jsonb;
  v_viewer_id uuid;
  v_actor_view jsonb;
  v_now timestamptz;
  v_result_inserted boolean;
  v_absence_due boolean;
  v_cancel_id uuid;
  v_job_kind text;
  v_job_phase_id uuid;
  v_job_run_at timestamptz;
  v_job_payload jsonb;
  v_round_no integer;
  v_round_completed_at timestamptz;
  v_next_deadline_at timestamptz;
  v_next_deadline_kind text;
begin
  if p_envelope is null or jsonb_typeof(p_envelope) is distinct from 'object' then
    raise exception 'INVALID_ENVELOPE';
  end if;

  begin
    v_match_id := (p_envelope->>'matchId')::uuid;
    v_command_id := (p_envelope->>'commandId')::uuid;
    v_job_id := nullif(p_envelope->>'jobId', '')::uuid;
    v_lease_token := nullif(p_envelope->>'leaseToken', '')::uuid;
    v_expected_version := (p_envelope->>'expectedVersion')::bigint;
    v_previous_phase_id := (p_envelope->>'previousPhaseId')::uuid;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'INVALID_ENVELOPE';
  end;
  begin
    v_actor_id := nullif(p_envelope->>'actorId', '')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'INVALID_ENVELOPE';
  end;
  v_source := coalesce(nullif(p_envelope->>'source', ''), 'player');
  v_event := p_envelope->'event';
  v_command_hash := p_envelope->>'commandHash';
  v_command_type := nullif(btrim(p_envelope->>'commandType'), '');
  if v_command_type is null then
    v_command_type := case v_event->>'type'
      when 'PLAYER_RESIGNED' then 'RESIGN'
      when 'FORFEIT_CLAIMED' then 'CLAIM_FORFEIT'
      else v_event->>'type'
    end;
  end if;
  v_next := p_envelope->'next';
  v_state := v_next->'state';
  v_result := nullif(p_envelope->'result', 'null'::jsonb);

  if v_match_id is null
     or v_command_id is null
     or v_expected_version is null
     or v_expected_version < 0
     or v_previous_phase_id is null
     or v_command_type is null
     or char_length(v_command_type) > 80
     or v_command_hash is null
     or v_command_hash !~ '^[0-9a-f]{64}$'
     or v_source not in ('player', 'job')
     or jsonb_typeof(v_next) is distinct from 'object'
     or jsonb_typeof(v_state) is distinct from 'object'
     or jsonb_typeof(v_event) is distinct from 'object'
     or jsonb_typeof(v_event->'payload') is distinct from 'object'
  then
    raise exception 'INVALID_ENVELOPE';
  end if;

  begin
    v_new_phase_id := (v_next->>'phaseId')::uuid;
    v_next_deadline_at := nullif(v_next->>'deadlineAt', '')::timestamptz;
  exception
    when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
      raise exception 'INVALID_NEXT';
  end;
  v_next_deadline_kind := nullif(v_next->>'deadlineKind', '');
  if v_new_phase_id is null
     or (v_next ? 'deadlineAt') is false
     or (v_next ? 'deadlineKind') is false
     or ((v_next_deadline_at is null and v_next_deadline_kind is not null)
     or (v_next_deadline_at is not null and v_next_deadline_kind is null))
  then
    raise exception 'INVALID_NEXT';
  end if;

  -- The match lock comes before all receipt/version/deadline decisions.
  select *
  into v_match
  from private.matches
  where id = v_match_id
  for update;
  if not found then
    raise exception 'MATCH_NOT_FOUND';
  end if;
  v_now := clock_timestamp();

  select g.kind
  into v_match_kind
  from public.games as g
  where g.slug = v_match.game_slug;
  if v_match_kind is null then
    raise exception 'INVALID_MATCH_DATA';
  end if;

  if v_source = 'job' then
    if v_job_id is null or v_lease_token is null or v_actor_id is not null or v_command_id <> v_job_id then
      raise exception 'INVALID_JOB_COMMAND';
    end if;
    select *
    into v_current_job
    from private.jobs
    where id = v_job_id
    for update;
    if not found or v_current_job.match_id is distinct from v_match_id then
      raise exception 'JOB_LEASE_INVALID';
    end if;

    select payload_hash, response
    into v_receipt_hash, v_existing
    from private.job_receipts
    where job_id = v_job_id;
    if found then
      if v_receipt_hash is distinct from v_command_hash
         or v_current_job.kind is distinct from v_command_type
      then
        raise exception 'COMMAND_ID_REUSED';
      end if;
      return v_existing;
    end if;
  else
    if v_job_id is not null or v_lease_token is not null or v_actor_id is null then
      raise exception 'INVALID_COMMIT_SOURCE';
    end if;

    select actor_id, action_type, payload_hash, response
    into v_receipt_actor, v_receipt_type, v_receipt_hash, v_existing
    from private.command_receipts
    where match_id = v_match_id
      and command_id = v_command_id;
    if found then
      if v_receipt_actor is distinct from v_actor_id
         or v_receipt_type is distinct from v_command_type
         or v_receipt_hash is distinct from v_command_hash
      then
        raise exception 'COMMAND_ID_REUSED';
      end if;
      return v_existing;
    end if;
  end if;

  if v_match.status <> 'active' then
    raise exception 'MATCH_NOT_ACTIVE';
  end if;
  if v_match.version <> v_expected_version then
    raise exception 'VERSION_CONFLICT';
  end if;
  if v_match.phase_id <> v_previous_phase_id then
    raise exception 'PHASE_CONFLICT';
  end if;

  if v_source = 'player' then
    select mp.seat
    into v_actor_seat
    from private.match_players as mp
    where mp.match_id = v_match_id
      and mp.user_id = v_actor_id;
    if not found then
      raise exception 'NOT_A_PARTICIPANT';
    end if;
    if v_command_type in (
      'check_absence', 'judge_answer', 'preparation_timeout',
      'choose_level_timeout', 'turn_timeout', 'advance_reveal',
      'contest_timeout', 'release_ai_reservation'
    ) then
      raise exception 'INVALID_COMMAND_TYPE';
    end if;

    -- RESIGN and CLAIM_FORFEIT are admissible after the blocking deadline.
    -- The absence check is evaluated before touching the actor heartbeat.
    if v_command_type = 'CLAIM_FORFEIT'
       and not exists (
         select 1
         from private.match_players as mp
         where mp.match_id = v_match_id
           and mp.user_id <> v_actor_id
           and mp.last_seen_at <= v_now - interval '90 seconds'
       )
    then
      raise exception 'FORFEIT_NOT_AVAILABLE';
    end if;
    if v_command_type not in ('RESIGN', 'CLAIM_FORFEIT')
       and v_match.deadline_at is not null
       and v_now >= v_match.deadline_at
    then
      raise exception 'DEADLINE_EXPIRED';
    end if;
    update private.match_players
    set last_seen_at = v_now
    where match_id = v_match_id
      and user_id = v_actor_id;
  else
    if v_current_job.status <> 'running'
       or v_current_job.lease_token is distinct from v_lease_token
       or v_current_job.lease_until is null
       or v_current_job.lease_until <= v_now
    then
      raise exception 'JOB_LEASE_INVALID';
    end if;
    v_job_kind := v_current_job.kind;
    if v_job_kind is distinct from v_command_type then
      raise exception 'INVALID_JOB_TYPE';
    end if;
    if v_current_job.run_at > v_now then
      raise exception 'JOB_NOT_DUE';
    end if;

    if v_job_kind = 'check_absence' then
      if v_current_job.phase_id is not null then
        raise exception 'STALE_JOB';
      end if;
      select (
        (select count(*) from private.match_players as mp
         where mp.match_id = v_match_id
           and mp.last_seen_at <= v_now - interval '120 seconds') = 2
        or exists (
          select 1 from private.match_players as mp
          where mp.match_id = v_match_id
            and mp.last_seen_at <= v_now - interval '180 seconds'
        )
      )
      into v_absence_due;
      if not v_absence_due then
        -- No-op: no version or result is changed. Mark this observation done
        -- and schedule the next periodic observation from the DB clock.
        update private.jobs
        set status = 'done',
            completed_at = v_now,
            lease_token = null,
            lease_until = null
        where id = v_job_id;
        insert into private.jobs (
          match_id, kind, phase_id, dedupe_key, payload, run_at, status
        )
        values (
          v_match_id,
          'check_absence',
          null,
          v_job_id::text || ':next',
          jsonb_build_object('matchId', v_match_id, 'kind', 'check_absence'),
          v_now + interval '30 seconds',
          'pending'
        )
        on conflict (dedupe_key) do nothing;
        return jsonb_build_object(
          'matchId', v_match_id,
          'version', v_match.version,
          'commandHash', v_command_hash,
          'jobId', v_job_id,
          'status', 'noop'
        );
      end if;
    elsif v_job_kind not in (
      'judge_answer', 'preparation_timeout', 'choose_level_timeout',
      'turn_timeout', 'advance_reveal', 'contest_timeout'
    ) then
      raise exception 'UNSUPPORTED_COMMAND';
    elsif v_current_job.phase_id is null
       or v_current_job.phase_id <> v_match.phase_id
    then
      raise exception 'STALE_JOB';
    elsif v_job_kind <> 'judge_answer'
       and (v_match.deadline_at is null or v_now < v_match.deadline_at)
    then
      raise exception 'JOB_NOT_DUE';
    end if;
  end if;

  v_new_version := v_match.version + 1;
  if (p_envelope ? 'jobsToCancel')
     and jsonb_typeof(p_envelope->'jobsToCancel') is distinct from 'array'
  then
    raise exception 'INVALID_JOB_DATA';
  end if;
  if (p_envelope ? 'jobsToUpsert')
     and jsonb_typeof(p_envelope->'jobsToUpsert') is distinct from 'array'
  then
    raise exception 'INVALID_JOB_DATA';
  end if;
  if (p_envelope ? 'roundRecords')
     and jsonb_typeof(p_envelope->'roundRecords') is distinct from 'array'
  then
    raise exception 'INVALID_ROUND';
  end if;
  if jsonb_typeof(p_envelope->'views') is distinct from 'array'
     or jsonb_array_length(p_envelope->'views') <> 2
  then
    raise exception 'INVALID_VIEWS';
  end if;
  for v_view_item in
    select value from jsonb_array_elements(p_envelope->'views')
  loop
    begin
      v_viewer_id := (v_view_item->>'viewerId')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'INVALID_VIEWER';
    end;
    if not exists (
      select 1
      from private.match_players as mp
      where mp.match_id = v_match_id
        and mp.user_id = v_viewer_id
    ) then
      raise exception 'INVALID_VIEWER';
    end if;
    if jsonb_typeof(v_view_item->'payload') is distinct from 'object' then
      raise exception 'INVALID_VIEW';
    end if;
    if v_source = 'player' and v_viewer_id = v_actor_id then
      v_actor_view := v_view_item->'payload';
    end if;
  end loop;
  if (
    select count(distinct (value->>'viewerId')::uuid)
    from jsonb_array_elements(p_envelope->'views')
  ) <> 2
  then
    raise exception 'INVALID_VIEWS';
  end if;
  if (
    select count(*)
    from private.match_players as mp
    where mp.match_id = v_match_id
      and exists (
        select 1
        from jsonb_array_elements(p_envelope->'views') as item
        where (item->>'viewerId')::uuid = mp.user_id
      )
  ) <> 2
  then
    raise exception 'INVALID_VIEWS';
  end if;
  if v_source = 'player' and v_actor_view is null then
    raise exception 'MISSING_ACTOR_VIEW';
  end if;

  for v_job_item in
    select value from jsonb_array_elements(
      coalesce(nullif(p_envelope->'jobsToCancel', 'null'::jsonb), '[]'::jsonb)
    )
  loop
    begin
      v_cancel_id := case
        when jsonb_typeof(v_job_item) = 'string' then (v_job_item #>> '{}')::uuid
        when jsonb_typeof(v_job_item) = 'object' then (v_job_item->>'jobId')::uuid
        else null
      end;
    exception
      when invalid_text_representation then
        raise exception 'INVALID_JOB_DATA';
    end;
    if v_cancel_id is null then
      raise exception 'INVALID_JOB_DATA';
    end if;
    if v_source = 'job' and v_cancel_id = v_job_id then
      raise exception 'INVALID_JOB_DATA';
    end if;
    if not exists (
      select 1
      from private.jobs as j
      where j.id = v_cancel_id
        and j.match_id = v_match_id
    ) then
      raise exception 'INVALID_JOB_DATA';
    end if;
    update private.jobs
    set status = 'cancelled',
        completed_at = v_now,
        lease_token = null,
        lease_until = null
    where id = v_cancel_id
      and match_id = v_match_id
      and status in ('pending', 'running');
  end loop;

  for v_job_item in
    select value from jsonb_array_elements(
      coalesce(nullif(p_envelope->'jobsToUpsert', 'null'::jsonb), '[]'::jsonb)
    )
  loop
    v_job_kind := v_job_item->>'kind';
    begin
      v_job_phase_id := nullif(v_job_item->>'phaseId', '')::uuid;
      v_job_run_at := (v_job_item->>'runAt')::timestamptz;
  exception
      when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
        raise exception 'INVALID_JOB_DATA';
    end;
    v_job_payload := coalesce(
      nullif(v_job_item->'payload', 'null'::jsonb),
      '{}'::jsonb
    );
    if v_job_kind is null
       or v_job_kind not in (
         'check_absence', 'judge_answer', 'preparation_timeout',
         'choose_level_timeout', 'turn_timeout', 'advance_reveal',
         'contest_timeout', 'release_ai_reservation'
       )
       or v_job_item->>'dedupeKey' is null
       or btrim(v_job_item->>'dedupeKey') = ''
       or v_job_run_at is null
       or (v_job_kind = 'check_absence' and v_job_phase_id is not null)
       or (v_job_kind <> 'check_absence' and v_job_phase_id is null)
       or jsonb_typeof(v_job_payload) is distinct from 'object'
    then
      raise exception 'INVALID_JOB_DATA';
    end if;
    insert into private.jobs (
      match_id, kind, phase_id, dedupe_key, payload, run_at, status
    )
    values (
      v_match_id,
      v_job_kind,
      v_job_phase_id,
      v_job_item->>'dedupeKey',
      v_job_payload,
      v_job_run_at,
      'pending'
    )
    on conflict (dedupe_key) do nothing;
  end loop;

  if v_result is not null then
    -- A terminal transition makes every other runnable job obsolete. This is
    -- distinct from an active transition, which only cancels explicit IDs.
    update private.jobs
    set status = 'cancelled',
        completed_at = v_now,
        lease_token = null,
        lease_until = null
    where match_id = v_match_id
      and status in ('pending', 'running')
      and (v_source <> 'job' or id <> v_job_id);
  end if;

  update private.matches
  set state = v_state,
      version = v_new_version,
      phase_id = v_new_phase_id,
      deadline_at = v_next_deadline_at,
      deadline_kind = v_next_deadline_kind,
      status = case
        when v_result is null then 'active'
        when v_result->>'outcome' = 'abandoned' then 'abandoned'
        else 'completed'
      end,
      ended_at = case when v_result is null then null else v_now end,
      end_reason = case when v_result is null then null else v_result->>'reason' end
  where id = v_match_id;

  if v_result is null
     and not exists (
       select 1
       from private.jobs as absence_job
       where absence_job.match_id = v_match_id
         and absence_job.kind = 'check_absence'
         and absence_job.status in ('pending', 'running')
         and (v_source <> 'job' or absence_job.id <> v_job_id)
     )
  then
    insert into private.jobs (
      match_id, kind, phase_id, dedupe_key, payload, run_at, status
    )
    values (
      v_match_id,
      'check_absence',
      null,
      v_match_id::text || ':absence:' || v_new_version::text,
      jsonb_build_object('matchId', v_match_id, 'kind', 'check_absence'),
      v_now + interval '30 seconds',
      'pending'
    )
    on conflict (dedupe_key) do nothing;
  end if;

  for v_record in
    select value from jsonb_array_elements(
      coalesce(nullif(p_envelope->'roundRecords', 'null'::jsonb), '[]'::jsonb)
    )
  loop
    begin
      v_round_no := (v_record->>'roundNo')::integer;
      v_round_completed_at := (v_record->>'completedAt')::timestamptz;
    exception
      when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
        raise exception 'INVALID_ROUND';
    end;
    if jsonb_typeof(v_record) is distinct from 'object'
       or v_round_no is null
       or v_round_no <= 0
       or v_round_completed_at is null
       or jsonb_typeof(v_record->'summary') is distinct from 'object'
    then
      raise exception 'INVALID_ROUND';
    end if;
    insert into private.round_results (
      match_id, round_no, summary, completed_at
    )
    values (
      v_match_id,
      v_round_no,
      v_record->'summary',
      v_round_completed_at
    )
    on conflict (match_id, round_no) do nothing;
  end loop;

  insert into private.match_events (
    match_id, version, event_type, actor_id, payload
  )
  values (
    v_match_id,
    v_new_version,
    coalesce(v_event->>'type', 'TRANSITION'),
    case when v_source = 'player' then v_actor_id else null end,
    coalesce(nullif(v_event->'payload', 'null'::jsonb), '{}'::jsonb)
  );

  for v_view_item in
    select value from jsonb_array_elements(p_envelope->'views')
  loop
    insert into public.match_views (
      match_id, viewer_id, version, payload, updated_at
    )
    values (
      v_match_id,
      (v_view_item->>'viewerId')::uuid,
      v_new_version,
      v_view_item->'payload',
      v_now
    )
    on conflict (match_id, viewer_id) do update set
      version = excluded.version,
      payload = excluded.payload,
      updated_at = excluded.updated_at;
  end loop;

  if v_result is not null then
    v_result_inserted := private.record_match_result(
      v_match_id, v_match, v_result, v_now
    );
    if v_result_inserted is distinct from true then
      raise exception 'RESULT_ALREADY_FINALIZED';
    end if;
  end if;

  v_existing := jsonb_build_object(
    'matchId', v_match_id,
    'version', v_new_version,
    'commandHash', v_command_hash,
    'view', v_actor_view
  );
  if v_source = 'job' then
    update private.jobs
    set status = 'done',
        completed_at = v_now,
        lease_token = null,
        lease_until = null
    where id = v_job_id;
    v_existing := v_existing || jsonb_build_object('jobId', v_job_id);
    insert into private.job_receipts (
      job_id, payload_hash, committed_version, response
    )
    values (v_job_id, v_command_hash, v_new_version, v_existing);
  else
    insert into private.command_receipts (
      match_id, command_id, actor_id, action_type, payload_hash,
      committed_version, response
    )
    values (
      v_match_id, v_command_id, v_actor_id, v_command_type, v_command_hash,
      v_new_version, v_existing
    );
  end if;
  return v_existing;
end;
$$;

revoke all on function private.record_match_result(uuid, private.matches, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function private.finalize_match_technical_error(uuid, private.matches, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function private.claim_due_jobs(integer) from public, anon, authenticated;
revoke all on function private.dispatch_due_jobs() from public, anon, authenticated;
revoke all on function public.server_set_room_ready(uuid, uuid, uuid, bigint, boolean) from public, anon, authenticated;
revoke all on function public.server_finish_job(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.server_fail_job(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.server_commit_match(jsonb) from public, anon, authenticated;

grant execute on function private.claim_due_jobs(integer) to service_role;
grant execute on function private.dispatch_due_jobs() to service_role;
grant execute on function private.record_match_result(uuid, private.matches, jsonb, timestamptz) to service_role;
grant execute on function private.finalize_match_technical_error(uuid, private.matches, uuid, text, timestamptz) to service_role;
grant execute on function public.server_set_room_ready(uuid, uuid, uuid, bigint, boolean) to service_role;
grant execute on function public.server_finish_job(uuid, uuid, text, text) to service_role;
grant execute on function public.server_fail_job(uuid, uuid, text) to service_role;
grant execute on function public.server_commit_match(jsonb) to service_role;
