-- tibo.fun — suppression du forfait et grâce de sortie de 30 secondes
--
-- Décision produit du 17/09/2026 :
--   * « Réclamer un forfait » disparaît complètement : seuls RESIGN (qui perd)
--     et la poursuite de la partie restent possibles ;
--   * quitter une partie sans abandonner laisse exactement 30 secondes pour
--     revenir. Passé ce délai, le joueur parti est considéré comme ayant
--     abandonné : l'adversaire gagne les jeux compétitifs, les jeux
--     coopératifs se terminent sans vainqueur ;
--   * le salon ne se rejoint plus par code une fois la partie lancée ; la
--     reprise passe uniquement par l'URL de la partie pendant la grâce.
--
-- Migration additive : les corps remplacés conservent leurs signatures.

-- ---------------------------------------------------------------------------
-- 1. Commit transactionnel : plus de forfait, absence à 30 s, observation 5 s
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.server_commit_match(p_envelope jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
      'contest_timeout', 'clue_timeout', 'guess_timeout', 'release_ai_reservation',
      'CLAIM_FORFEIT'
    ) then
      raise exception 'INVALID_COMMAND_TYPE';
    end if;

    -- Seul RESIGN reste admissible après l'échéance bloquante.
    if v_command_type <> 'RESIGN'
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
      select exists (
        select 1 from private.match_players as mp
        where mp.match_id = v_match_id
          and mp.last_seen_at <= v_now - interval '30 seconds'
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
          v_now + interval '5 seconds',
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
      'turn_timeout', 'advance_reveal', 'contest_timeout', 'clue_timeout', 'guess_timeout'
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
         'contest_timeout', 'clue_timeout', 'guess_timeout', 'release_ai_reservation'
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
      v_now + interval '5 seconds',
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
$function$;


-- ---------------------------------------------------------------------------
-- 2. Fin de job : réarme l'observation d'absence 5 s plus tard
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.server_finish_job(p_job_id uuid, p_lease_token uuid, p_status text, p_error_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
      v_now + interval '5 seconds',
      'pending'
    )
    on conflict (dedupe_key) do nothing;
  end if;
  return jsonb_build_object('jobId', p_job_id, 'status', p_status);
end;
$function$;


-- ---------------------------------------------------------------------------
-- 3. Rejoindre un salon : refusé dès que la partie a démarré
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.server_join_room(p_actor uuid, p_request_id uuid, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_existing jsonb;
  v_room private.rooms%rowtype;
  v_member private.room_members%rowtype;
  v_seat smallint;
  v_version bigint;
begin
  select response into v_existing
  from private.request_receipts
  where actor_id = p_actor and request_id = p_request_id and route = 'join_room';
  if v_existing is not null then return v_existing; end if;

  if not exists (
    select 1 from private.site_members
    where user_id = p_actor and status = 'active'
  ) then
    raise exception 'MEMBER_REQUIRED';
  end if;

  select * into v_room
  from private.rooms
  where code = upper(trim(p_code))
  for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  -- A participant who already has a row may recover a playing match by
  -- following the code again. A new participant may only join a live lobby.
  select * into v_member
  from private.room_members
  where room_id = v_room.id and user_id = p_actor;
  if found then
    if v_room.status <> 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;
    if v_room.status = 'waiting' and v_room.expires_at <= clock_timestamp() then
      raise exception 'ROOM_CLOSED';
    end if;
    update private.room_members
    set last_seen_at = clock_timestamp()
    where room_id = v_room.id and user_id = p_actor;
    v_existing := jsonb_build_object(
      'roomId', v_room.id,
      'code', v_room.code,
      'version', v_room.version,
      'currentMatchId', v_room.current_match_id
    );
  else
    if v_room.status <> 'waiting' or v_room.expires_at <= clock_timestamp() then
      raise exception 'ROOM_CLOSED';
    end if;
    if exists (select 1 from private.room_members where room_id = v_room.id and seat = 1) then
      raise exception 'ROOM_FULL';
    end if;
    v_seat := 1;
    insert into private.room_members (room_id, user_id, seat, ready)
    values (v_room.id, p_actor, v_seat, false);
    update private.rooms
    set version = version + 1,
        expires_at = clock_timestamp() + interval '24 hours'
    where id = v_room.id
    returning version into v_version;
    perform private.refresh_room_views(v_room.id);
    v_existing := jsonb_build_object(
      'roomId', v_room.id,
      'code', v_room.code,
      'version', v_version,
      'currentMatchId', null
    );
  end if;

  insert into private.request_receipts (actor_id, request_id, route, payload_hash, response)
  values (
    p_actor,
    p_request_id,
    'join_room',
    encode(extensions.digest(convert_to(upper(trim(p_code)), 'UTF8'), 'sha256'), 'hex'),
    v_existing
  );
  return v_existing;
end;
$function$;

