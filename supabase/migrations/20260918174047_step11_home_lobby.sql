-- tibo.fun — Étape 11 : salon d'accueil générique (groupe avant le jeu).
--
-- Contenu, entièrement additif :
--   1. `rooms.game_slug` devient nullable : un salon peut exister avant le
--      choix du jeu (salon « générique » créé depuis l'accueil).
--   2. `server_create_lobby` crée (ou renvoie) le salon générique actif d'un
--      membre, sans jeu ni configuration.
--   3. `server_get_active_lobby` expose à un membre son salon générique actif,
--      structure identique à `server_get_room` (viewerId, hostId, expiresAt).
--   4. `server_start_match` refuse explicitement un salon sans jeu.
--
-- Aucune migration déjà appliquée n'est réécrite ; les créations remplacent
-- des définitions existantes et conservent leurs signatures.

-- ---------------------------------------------------------------------------
-- 1. Salon sans jeu
-- ---------------------------------------------------------------------------

alter table private.rooms alter column game_slug drop not null;

-- ---------------------------------------------------------------------------
-- 2. Salon générique actif du membre
-- ---------------------------------------------------------------------------

create or replace function public.server_get_active_lobby(p_actor uuid)
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
  where rv.viewer_id = p_actor
    and r.status = 'waiting'
    and r.game_slug is null
    and r.expires_at > clock_timestamp()
  order by r.updated_at desc
  limit 1;
$$;

revoke all on function public.server_get_active_lobby(uuid) from public, anon, authenticated;
grant execute on function public.server_get_active_lobby(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Création idempotente d'un salon générique
-- ---------------------------------------------------------------------------

create or replace function public.server_create_lobby(
  p_actor uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_active jsonb;
  v_room_id uuid;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
begin
  select response into v_existing from private.request_receipts
  where actor_id = p_actor and request_id = p_request_id and route = 'create_lobby';
  if v_existing is not null then return v_existing; end if;
  if not exists (select 1 from private.site_members where user_id = p_actor and status = 'active') then
    raise exception 'MEMBER_REQUIRED';
  end if;

  -- Un seul salon générique actif par membre : on renvoie l'existant.
  select public.server_get_active_lobby(p_actor) into v_active;
  if v_active is not null then
    v_existing := jsonb_build_object(
      'roomId', v_active->>'roomId',
      'code', v_active->>'code',
      'version', (v_active->>'version')::bigint
    );
    insert into private.request_receipts (actor_id, request_id, route, payload_hash, response)
    values (p_actor, p_request_id, 'create_lobby', encode(extensions.digest(convert_to('lobby', 'UTF8'), 'sha256'), 'hex'), v_existing);
    return v_existing;
  end if;

  v_room_id := extensions.gen_random_uuid();
  loop
    v_bytes := extensions.gen_random_bytes(6);
    v_code := '';
    for v_byte_index in 0..5 loop
      v_code := v_code || substr(v_alphabet, 1 + (get_byte(v_bytes, v_byte_index) % length(v_alphabet)), 1);
    end loop;
    exit when not exists (select 1 from private.rooms where code = v_code);
  end loop;

  insert into private.rooms (id, code, host_id, game_slug, config, version, expires_at)
  values (v_room_id, v_code, p_actor, null, '{}'::jsonb, 1, clock_timestamp() + interval '24 hours');
  insert into private.room_members (room_id, user_id, seat, ready)
  values (v_room_id, p_actor, 0, false);
  perform private.refresh_room_views(v_room_id);

  v_existing := jsonb_build_object('roomId', v_room_id, 'code', v_code, 'version', 1);
  insert into private.request_receipts (actor_id, request_id, route, payload_hash, response)
  values (p_actor, p_request_id, 'create_lobby', encode(extensions.digest(convert_to('lobby', 'UTF8'), 'sha256'), 'hex'), v_existing);
  return v_existing;
end;
$$;

revoke all on function public.server_create_lobby(uuid, uuid) from public, anon, authenticated;
grant execute on function public.server_create_lobby(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Refus de démarrer une partie sans jeu choisi
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
  if v_room.game_slug is null then raise exception 'GAME_NOT_READY'; end if;
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
