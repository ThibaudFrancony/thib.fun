-- Étape 8 — garde de version des commandes avancées du salon.
-- La migration précédente est déjà appliquée localement : son corps n'est
-- pas réécrit ; cette définition additive corrige sa signature existante.

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

revoke all on function public.server_change_room(uuid, uuid, uuid, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.server_change_room(uuid, uuid, uuid, bigint, jsonb) to service_role;
