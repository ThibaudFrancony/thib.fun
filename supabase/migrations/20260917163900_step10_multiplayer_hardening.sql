-- tibo.fun — durcissement multijoueur (étape 10)
--
-- Contenu, entièrement additif et rejouable :
--   1. Aperçu minimal de salon pour permettre de rejoindre un lien partagé.
--   2. Sortie possible d'un salon fermé (nettoyage de la place fantôme).
--   3. Reçu de START vérifié (acteur, type) et clôture explicite des parties
--      actives précédentes des deux joueurs (`superseded`).
--   4. Reprise worker : les jobs de service ne peuvent plus abandonner une
--      partie, et les baux épuisés orphelins sont clôturés par un cron dédié.
--
-- Aucune migration déjà appliquée n'est réécrite ; les créations remplacent
-- des définitions existantes et conservent leurs signatures.

-- ---------------------------------------------------------------------------
-- 1. Aperçu de salon (non-membre, lien partagé)
-- ---------------------------------------------------------------------------

create or replace function public.server_get_room_preview(
  p_actor uuid,
  p_room_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room private.rooms%rowtype;
  v_member_count integer;
  v_is_member boolean;
begin
  if p_actor is null or p_room_id is null then
    raise exception 'INVALID_ROOM_ACTION';
  end if;
  select * into v_room from private.rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  select count(*) into v_member_count from private.room_members where room_id = p_room_id;
  select exists (
    select 1 from private.room_members where room_id = p_room_id and user_id = p_actor
  ) into v_is_member;
  return jsonb_build_object(
    'roomId', v_room.id,
    'code', v_room.code,
    'gameSlug', v_room.game_slug,
    'status', v_room.status,
    'expiresAt', v_room.expires_at,
    'memberCount', v_member_count,
    'viewerIsMember', v_is_member,
    'currentMatchId', v_room.current_match_id
  );
end;
$$;

revoke all on function public.server_get_room_preview(uuid, uuid) from public, anon, authenticated;
grant execute on function public.server_get_room_preview(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Sortie d'un salon fermé (copie de la garde de version Étape 8)
-- ---------------------------------------------------------------------------

create or replace function public.server_change_room(
  p_actor uuid,
  p_command_id uuid,
  p_room_id uuid,
  p_expected_version bigint,
  p_action jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room private.rooms%rowtype;
  v_receipt private.room_command_receipts%rowtype;
  v_game public.games%rowtype;
  v_action_type text;
  v_hash text;
  v_version bigint;
  v_target uuid;
  v_new_host uuid;
  v_remaining_count integer;
  v_expired boolean;
  v_response jsonb;
begin
  if p_actor is null
     or p_command_id is null
     or p_room_id is null
     or p_action is null
     or jsonb_typeof(p_action) is distinct from 'object' then
    raise exception 'INVALID_ROOM_ACTION';
  end if;

  v_action_type := p_action->>'type';
  if v_action_type not in ('LEAVE', 'REJOIN', 'REMATCH', 'SET_CONFIG', 'TRANSFER_HOST') then
    raise exception 'INVALID_ROOM_ACTION';
  end if;
  v_hash := encode(extensions.digest(convert_to(p_action::text, 'UTF8'), 'sha256'), 'hex');

  select * into v_room from private.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  select * into v_receipt
  from private.room_command_receipts
  where room_id = p_room_id and command_id = p_command_id;
  if found then
    if v_receipt.actor_id is distinct from p_actor
       or v_receipt.action_type is distinct from v_action_type
       or v_receipt.payload_hash is distinct from v_hash then
      raise exception 'COMMAND_ID_REUSED';
    end if;
    return v_receipt.response;
  end if;

  if not exists (
    select 1 from private.site_members
    where user_id = p_actor and status = 'active'
  ) or not exists (
    select 1 from private.room_members
    where room_id = p_room_id and user_id = p_actor
  ) then
    raise exception 'NOT_A_ROOM_MEMBER';
  end if;
  if v_room.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;

  v_expired := v_room.expires_at <= clock_timestamp();
  if v_action_type <> 'LEAVE' and v_expired then raise exception 'ROOM_EXPIRED'; end if;

  if v_action_type = 'REJOIN' then
    if v_room.status = 'closed' then raise exception 'ROOM_NOT_WAITING'; end if;
    update private.room_members
    set last_seen_at = clock_timestamp()
    where room_id = p_room_id and user_id = p_actor;
    v_response := jsonb_build_object(
      'roomId', p_room_id,
      'version', v_room.version,
      'rejoined', true,
      'currentMatchId', v_room.current_match_id
    );
  elsif v_action_type = 'LEAVE' then
    -- La sortie reste possible sur un salon fermé pour libérer la place ;
    -- une partie en cours exige un abandon de partie, pas un LEAVE.
    if v_room.status = 'playing' then raise exception 'ROOM_NOT_WAITING'; end if;
    delete from private.room_members where room_id = p_room_id and user_id = p_actor;
    select count(*) into v_remaining_count from private.room_members where room_id = p_room_id;
    if v_remaining_count = 0 then
      update private.rooms
      set status = 'closed', current_match_id = null, version = version + 1
      where id = p_room_id
      returning version into v_version;
    else
      v_new_host := v_room.host_id;
      if v_room.host_id = p_actor then
        select user_id into v_new_host
        from private.room_members
        where room_id = p_room_id
        order by seat
        limit 1;
      end if;
      update private.room_members set ready = false where room_id = p_room_id;
      update private.rooms
      set host_id = v_new_host,
          status = case when v_expired or v_room.status = 'closed' then 'closed' else 'waiting' end,
          current_match_id = null,
          version = version + 1
      where id = p_room_id
      returning version into v_version;
    end if;
    perform private.refresh_room_views(p_room_id);
    v_response := jsonb_build_object(
      'roomId', p_room_id,
      'version', v_version,
      'gameSlug', v_room.game_slug,
      'left', true,
      'closed', v_expired or v_room.status = 'closed' or v_remaining_count = 0
    );
  elsif v_action_type = 'REMATCH' then
    if v_room.status <> 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;
    update private.room_members set ready = false where room_id = p_room_id;
    update private.rooms set version = version + 1 where id = p_room_id returning version into v_version;
    perform private.refresh_room_views(p_room_id);
    v_response := jsonb_build_object('roomId', p_room_id, 'version', v_version, 'rematch', true);
  elsif v_action_type = 'SET_CONFIG' then
    if v_room.status <> 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;
    if v_room.host_id <> p_actor then raise exception 'HOST_REQUIRED'; end if;
    if not (p_action ? 'gameSlug')
       or not (p_action ? 'config')
       or jsonb_typeof(p_action->'config') is distinct from 'object'
       or nullif(p_action->>'gameSlug', '') is null then
      raise exception 'INVALID_ROOM_ACTION';
    end if;
    select * into v_game from public.games where slug = p_action->>'gameSlug';
    if not found or v_game.availability = 'coming_soon' then raise exception 'GAME_NOT_READY'; end if;
    update private.room_members set ready = false where room_id = p_room_id;
    update private.rooms
    set game_slug = p_action->>'gameSlug', config = p_action->'config', version = version + 1
    where id = p_room_id
    returning version into v_version;
    perform private.refresh_room_views(p_room_id);
    v_response := jsonb_build_object(
      'roomId', p_room_id,
      'version', v_version,
      'gameSlug', p_action->>'gameSlug',
      'config', p_action->'config'
    );
  else
    if v_room.status <> 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;
    if v_room.host_id <> p_actor then raise exception 'HOST_REQUIRED'; end if;
    if not (p_action ? 'targetUserId')
       or (p_action->>'targetUserId') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then
      raise exception 'INVALID_ROOM_ACTION';
    end if;
    v_target := (p_action->>'targetUserId')::uuid;
    if v_target = p_actor or not exists (
      select 1 from private.room_members where room_id = p_room_id and user_id = v_target
    ) then
      raise exception 'ROOM_TARGET_NOT_MEMBER';
    end if;
    update private.rooms set host_id = v_target, version = version + 1 where id = p_room_id returning version into v_version;
    perform private.refresh_room_views(p_room_id);
    v_response := jsonb_build_object('roomId', p_room_id, 'version', v_version, 'hostId', v_target);
  end if;

  insert into private.room_command_receipts (
    room_id, command_id, actor_id, action_type, payload_hash, committed_version, response
  ) values (
    p_room_id, p_command_id, p_actor, v_action_type, v_hash, (v_response->>'version')::bigint, v_response
  );
  return v_response;
end;
$$;

revoke all on function public.server_change_room(uuid, uuid, uuid, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.server_change_room(uuid, uuid, uuid, bigint, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 2b. Raisons de clôture acceptées par la finalisation commune
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.record_match_result(p_match_id uuid, p_match_row private.matches, p_result jsonb, p_completed_at timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
       'absence', 'judging_unavailable', 'technical_error',
       'superseded', 'worker_unreachable'
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
$function$;

-- ---------------------------------------------------------------------------
-- 3. Clôture générique d'une partie active, conservée et traçable
-- ---------------------------------------------------------------------------

alter table private.match_results drop constraint if exists match_results_reason_check;
alter table private.match_results add constraint match_results_reason_check check (
  reason in (
    'normal', 'round_limit', 'turn_limit', 'blocked',
    'dictionary_exhausted', 'resign', 'claimed_forfeit',
    'absence', 'judging_unavailable', 'technical_error',
    'superseded', 'worker_unreachable'
  )
);

create or replace function private.finalize_match_abandoned(
  p_match_id uuid,
  p_match_row private.matches,
  p_job_id uuid,
  p_reason text,
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
  v_reason text := coalesce(nullif(left(p_reason, 60), ''), 'technical_error');
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
    'reason', v_reason,
    'summary', jsonb_build_object('type', v_reason),
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
      end_reason = v_reason
  where id = p_match_id;

  -- Une partie terminale invalide tous les jobs encore exécutables.
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
    'MATCH_ABANDONED',
    null,
    jsonb_build_object('reason', v_reason)
  );

  v_safe_result := jsonb_build_object(
    'outcome', 'abandoned',
    'winnerId', null,
    'sharedScore', null,
    'reason', v_reason
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
    'reason', v_reason,
    'resultInserted', v_result_inserted
  );
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
begin
  return private.finalize_match_abandoned(p_match_id, p_match_row, p_job_id, 'technical_error', p_now);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Jobs de service : ne jamais abandonner la partie pour un job technique
-- ---------------------------------------------------------------------------

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
  v_service_job boolean;
begin
  -- Match puis job : même ordre de verrou que server_commit_match.
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

  -- Les jobs de service (réservations IA) sont purement comptables : leur
  -- échec définitif ne doit jamais interrompre une partie saine.
  v_service_job := v_job.kind in ('release_ai_reservation');

  if v_job.attempts >= 5 then
    if v_match.id is not null and v_match.status = 'active' and not v_service_job then
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

-- ---------------------------------------------------------------------------
-- 5. Reprise des baux épuisés orphelins (worker injoignable ou tué)
--    `claim_due_jobs` réclame sans plafond un bail `running` expiré ; cette
--    fonction clôt les jobs qui ont déjà épuisé leurs tentatives.
-- ---------------------------------------------------------------------------

create or replace function private.reap_exhausted_jobs()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job private.jobs%rowtype;
  v_match private.matches%rowtype;
  v_now timestamptz := clock_timestamp();
  v_count integer := 0;
begin
  for v_job in
    select *
    from private.jobs
    where status = 'running'
      and lease_until <= v_now
      and attempts >= 5
    order by lease_until
    for update skip locked
    limit 20
  loop
    select * into v_match
    from private.matches
    where id = v_job.match_id
    for update;

    if v_match.id is not null
       and v_match.status = 'active'
       and v_job.kind not in ('release_ai_reservation') then
      perform private.finalize_match_abandoned(
        v_match.id, v_match, v_job.id, 'worker_unreachable', v_now
      );
    end if;

    update private.jobs
    set status = 'failed',
        last_error_code = coalesce(last_error_code, 'WORKER_UNREACHABLE'),
        completed_at = v_now,
        lease_token = null,
        lease_until = null
    where id = v_job.id;

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

do $migration$
declare
  v_job record;
begin
  for v_job in
    select jobid from cron.job where jobname = 'tibo-fun-reap-exhausted-jobs'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
  perform cron.schedule(
    'tibo-fun-reap-exhausted-jobs',
    '30 seconds',
    $job$select private.reap_exhausted_jobs();$job$
  );
end;
$migration$;

-- ---------------------------------------------------------------------------
-- 6. Démarrage de partie : reçu vérifié et clôture des parties précédentes
-- ---------------------------------------------------------------------------

create or replace function public.server_start_match(
  p_actor uuid,
  p_command_id uuid,
  p_room_id uuid,
  p_expected_version bigint,
  p_match_id uuid,
  p_mode text,
  p_config jsonb,
  p_state jsonb,
  p_phase_id uuid,
  p_deadline_at timestamptz,
  p_deadline_kind text,
  p_views jsonb,
  p_jobs jsonb,
  p_content_manifest jsonb,
  p_rules_version text,
  p_engine_version text,
  p_state_schema_version integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_room private.rooms%rowtype;
  v_game public.games%rowtype;
  v_match_id uuid := p_match_id;
  v_version bigint;
  v_item jsonb;
  v_job jsonb;
  v_receipt_actor uuid;
  v_receipt_type text;
  v_receipt_hash text;
  v_expected_hash text;
  v_previous private.matches%rowtype;
  v_now timestamptz;
begin
  select * into v_room from private.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  -- Reçu relu sous le verrou du salon, avec contrôle acteur/type/hash comme
  -- les autres commandes de salon.
  v_expected_hash := encode(extensions.digest(convert_to(coalesce(p_state, '{}'::jsonb)::text, 'UTF8'), 'sha256'), 'hex');
  select r.actor_id, r.action_type, r.payload_hash, r.response
  into v_receipt_actor, v_receipt_type, v_receipt_hash, v_existing
  from private.room_command_receipts as r
  where r.room_id = p_room_id and r.command_id = p_command_id;
  if found then
    if v_receipt_actor is distinct from p_actor
       or v_receipt_type is distinct from 'START_MATCH'
       or v_receipt_hash is distinct from v_expected_hash then
      raise exception 'COMMAND_ID_REUSED';
    end if;
    return v_existing;
  end if;

  if v_room.host_id <> p_actor then raise exception 'HOST_REQUIRED'; end if;
  if v_room.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if v_room.status <> 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;
  if v_room.expires_at <= clock_timestamp() then raise exception 'ROOM_EXPIRED'; end if;
  select * into v_game from public.games where slug = v_room.game_slug;
  if not found or v_game.availability = 'coming_soon' then raise exception 'GAME_NOT_READY'; end if;
  if (select count(*) from private.room_members where room_id = p_room_id) <> 2 then raise exception 'TWO_PLAYERS_REQUIRED'; end if;
  if exists (select 1 from private.room_members where room_id = p_room_id and not ready) then raise exception 'PLAYERS_NOT_READY'; end if;
  if p_mode not in ('random', 'challenge') then raise exception 'INVALID_MODE'; end if;
  if v_match_id is null then raise exception 'INVALID_MATCH_ID'; end if;

  -- Une nouvelle partie remplace explicitement toute partie encore active
  -- des deux joueurs : clôture sans gagnant, données et historique conservés.
  v_now := clock_timestamp();
  for v_previous in
    select m.*
    from private.matches as m
    where m.status = 'active'
      and exists (
        select 1
        from private.match_players as mp
        join private.room_members as rm on rm.user_id = mp.user_id
        where mp.match_id = m.id and rm.room_id = p_room_id
      )
    order by m.id
    for update
  loop
    perform private.finalize_match_abandoned(v_previous.id, v_previous, null, 'superseded', v_now);
  end loop;

  insert into private.matches (
    id, room_id, game_slug, mode, config, rules_version, engine_version,
    state_schema_version, content_manifest, state, version, phase_id,
    deadline_at, deadline_kind
  ) values (
    v_match_id, p_room_id, v_room.game_slug, p_mode, p_config, p_rules_version, p_engine_version,
    p_state_schema_version, p_content_manifest, p_state, 0, p_phase_id, p_deadline_at, p_deadline_kind
  );
  insert into private.match_players (match_id, user_id, seat, pseudo_snapshot, avatar_snapshot)
  select v_match_id, rm.user_id, rm.seat, p.pseudo, jsonb_build_object('preset', p.avatar_preset, 'path', p.avatar_path)
  from private.room_members rm
  join public.profiles p on p.id = rm.user_id
  where rm.room_id = p_room_id
  order by rm.seat;
  for v_item in select * from jsonb_array_elements(p_views) loop
    insert into public.match_views (match_id, viewer_id, version, payload)
    values (v_match_id, (v_item->>'viewerId')::uuid, 0, v_item->'payload');
  end loop;
  for v_job in select * from jsonb_array_elements(coalesce(p_jobs, '[]'::jsonb)) loop
    insert into private.jobs (match_id, kind, phase_id, dedupe_key, payload, run_at, status)
    values (v_match_id, v_job->>'kind', nullif(v_job->>'phaseId', '')::uuid, v_job->>'dedupeKey', coalesce(v_job->'payload', '{}'::jsonb), (v_job->>'runAt')::timestamptz, 'pending')
    on conflict (dedupe_key) do nothing;
  end loop;
  insert into private.jobs (match_id, kind, phase_id, dedupe_key, payload, run_at, status)
  values (
    v_match_id, 'check_absence', null, v_match_id::text || ':absence:0',
    jsonb_build_object('matchId', v_match_id, 'kind', 'check_absence'),
    clock_timestamp() + interval '30 seconds', 'pending'
  ) on conflict (dedupe_key) do nothing;
  update private.rooms set status = 'playing', current_match_id = v_match_id, version = version + 1 where id = p_room_id returning version into v_version;
  perform private.refresh_room_views(p_room_id);
  v_existing := jsonb_build_object('matchId', v_match_id, 'roomId', p_room_id, 'version', 0);
  insert into private.room_command_receipts (room_id, command_id, actor_id, action_type, payload_hash, committed_version, response)
  values (p_room_id, p_command_id, p_actor, 'START_MATCH', v_expected_hash, v_version, v_existing);
  return v_existing;
end;
$$;

revoke all on function public.server_start_match(uuid, uuid, uuid, bigint, uuid, text, jsonb, jsonb, uuid, timestamptz, text, jsonb, jsonb, jsonb, text, text, integer) from public, anon, authenticated;
grant execute on function public.server_start_match(uuid, uuid, uuid, bigint, uuid, text, jsonb, jsonb, uuid, timestamptz, text, jsonb, jsonb, jsonb, text, text, integer) to service_role;
