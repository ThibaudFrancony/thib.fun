-- tibo.fun — Étape 8 : gestion atomique des salons.
--
-- Cette migration est additive. Les migrations déjà appliquées restent
-- immuables ; les fonctions ci-dessous remplacent leurs corps via
-- CREATE OR REPLACE et conservent les mêmes signatures publiques.

create or replace function private.refresh_room_views(p_room_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room private.rooms%rowtype;
  v_payload jsonb;
  v_member record;
begin
  select * into v_room from private.rooms where id = p_room_id;
  if not found then return; end if;

  select jsonb_build_object(
    'kind', 'room',
    'roomId', v_room.id,
    'code', v_room.code,
    'hostId', v_room.host_id,
    'gameSlug', v_room.game_slug,
    'config', v_room.config,
    'status', v_room.status,
    'version', v_room.version,
    'expiresAt', v_room.expires_at,
    'currentMatchId', v_room.current_match_id,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'pseudo', p.pseudo,
        'isGuest', coalesce(sm.is_guest, false),
        'seat', rm.seat,
        'ready', rm.ready
      ) order by rm.seat)
      from private.room_members rm
      join public.profiles p on p.id = rm.user_id
      left join private.site_members sm on sm.user_id = rm.user_id
      where rm.room_id = p_room_id
    ), '[]'::jsonb)
  ) into v_payload;

  for v_member in select user_id from private.room_members where room_id = p_room_id loop
    insert into public.room_views (room_id, viewer_id, version, payload, updated_at)
    values (p_room_id, v_member.user_id, v_room.version, v_payload, clock_timestamp())
    on conflict (room_id, viewer_id) do update set
      version = excluded.version,
      payload = excluded.payload,
      updated_at = excluded.updated_at;
  end loop;
end;
$$;

create or replace function public.server_get_room(p_actor uuid, p_room_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select rv.payload || jsonb_build_object(
    'viewerId', p_actor,
    'hostId', r.host_id,
    'expiresAt', r.expires_at
  )
  from public.room_views rv
  join private.rooms r on r.id = rv.room_id
  join private.room_members rm on rm.room_id = rv.room_id and rm.user_id = rv.viewer_id
  join private.site_members sm on sm.user_id = rv.viewer_id and sm.status = 'active'
  where rv.room_id = p_room_id and rv.viewer_id = p_actor;
$$;

create or replace function public.server_join_room(
  p_actor uuid,
  p_request_id uuid,
  p_code text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
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
    if v_room.status = 'closed' then raise exception 'ROOM_CLOSED'; end if;
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
  v_existing jsonb;
  v_receipt private.room_command_receipts%rowtype;
  v_room private.rooms%rowtype;
  v_version bigint;
  v_hash text := encode(extensions.digest(convert_to(p_ready::text, 'UTF8'), 'sha256'), 'hex');
begin
  select * into v_room from private.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  select * into v_receipt
  from private.room_command_receipts
  where room_id = p_room_id and command_id = p_command_id;
  if found then
    if v_receipt.actor_id is distinct from p_actor
       or v_receipt.action_type is distinct from 'SET_READY'
       or v_receipt.payload_hash is distinct from v_hash then
      raise exception 'COMMAND_ID_REUSED';
    end if;
    return v_receipt.response;
  end if;

  if not exists (select 1 from private.room_members where room_id = p_room_id and user_id = p_actor) then
    raise exception 'NOT_A_ROOM_MEMBER';
  end if;
  if v_room.status <> 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;
  if v_room.expires_at <= clock_timestamp() then raise exception 'ROOM_EXPIRED'; end if;
  if v_room.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;

  update private.room_members
  set ready = p_ready, last_seen_at = clock_timestamp()
  where room_id = p_room_id and user_id = p_actor;
  update private.rooms
  set version = version + 1
  where id = p_room_id
  returning version into v_version;
  perform private.refresh_room_views(p_room_id);
  v_existing := jsonb_build_object('roomId', p_room_id, 'version', v_version, 'ready', p_ready);
  insert into private.room_command_receipts (
    room_id, command_id, actor_id, action_type, payload_hash, committed_version, response
  ) values (
    p_room_id, p_command_id, p_actor, 'SET_READY', v_hash, v_version, v_existing
  );
  return v_existing;
end;
$$;

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
    if v_room.status <> 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;
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
          status = case when v_expired then 'closed' else 'waiting' end,
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
      'closed', v_expired or v_remaining_count = 0
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

create or replace function public.server_room_heartbeat(p_actor uuid, p_room_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room private.rooms%rowtype;
  v_match_version bigint;
begin
  select * into v_room from private.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if not exists (select 1 from private.room_members where room_id = p_room_id and user_id = p_actor) then
    raise exception 'NOT_A_ROOM_MEMBER';
  end if;
  if v_room.status = 'closed' then raise exception 'ROOM_CLOSED'; end if;

  if v_room.status = 'waiting' and v_room.expires_at <= clock_timestamp() then
    update private.rooms set status = 'closed', version = version + 1 where id = p_room_id returning * into v_room;
    perform private.refresh_room_views(p_room_id);
  end if;
  update private.room_members set last_seen_at = clock_timestamp() where room_id = p_room_id and user_id = p_actor;
  select m.version into v_match_version from private.matches m where m.id = v_room.current_match_id;
  return jsonb_build_object(
    'roomId', p_room_id,
    'roomVersion', v_room.version,
    'matchVersion', v_match_version,
    'status', v_room.status,
    'serverNow', clock_timestamp()
  );
end;
$$;

-- server_start_match is kept in the same contract, with the room expiry guard
-- added before any private match row is inserted.
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
begin
  select response into v_existing from private.room_command_receipts where room_id = p_room_id and command_id = p_command_id;
  if v_existing is not null then return v_existing; end if;
  select * into v_room from private.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
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
  values (p_room_id, p_command_id, p_actor, 'START_MATCH', encode(extensions.digest(convert_to(p_state::text, 'UTF8'), 'sha256'), 'hex'), v_version, v_existing);
  return v_existing;
end;
$$;

revoke all on function public.server_change_room(uuid, uuid, uuid, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.server_change_room(uuid, uuid, uuid, bigint, jsonb) to service_role;
