-- tibo.fun — Étape 11b : préparer une partie depuis le salon d'accueil.
--
-- Dans un salon d'accueil (groupe formé avant le choix du jeu), l'hôte choisit
-- le jeu et lance sans étape « prêt » explicite : cette RPC pose le jeu, la
-- configuration et marque les deux joueurs prêts de façon atomique, à condition
-- que le salon soit complet et en attente. Le moteur reste lancé par la route
-- serveur habituelle (`server_start_match`), qui exige toujours deux joueurs
-- prêts — l'invariant de sécurité est conservé.
--
-- Entièrement additif ; aucune migration déjà appliquée n'est réécrite.

create or replace function public.server_prepare_lobby_match(
  p_actor uuid,
  p_command_id uuid,
  p_room_id uuid,
  p_expected_version bigint,
  p_game_slug text,
  p_config jsonb
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
  v_hash text;
  v_version bigint;
  v_response jsonb;
begin
  if p_actor is null
     or p_command_id is null
     or p_room_id is null
     or nullif(p_game_slug, '') is null
     or p_config is null
     or jsonb_typeof(p_config) is distinct from 'object' then
    raise exception 'INVALID_ROOM_ACTION';
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_object('gameSlug', p_game_slug, 'config', p_config)::text, 'UTF8'), 'sha256'), 'hex');

  select * into v_room from private.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  select * into v_receipt
  from private.room_command_receipts
  where room_id = p_room_id and command_id = p_command_id;
  if found then
    if v_receipt.actor_id is distinct from p_actor
       or v_receipt.action_type is distinct from 'PREPARE_MATCH'
       or v_receipt.payload_hash is distinct from v_hash then
      raise exception 'COMMAND_ID_REUSED';
    end if;
    return v_receipt.response;
  end if;

  if not exists (
    select 1 from private.site_members where user_id = p_actor and status = 'active'
  ) or not exists (
    select 1 from private.room_members where room_id = p_room_id and user_id = p_actor
  ) then
    raise exception 'NOT_A_ROOM_MEMBER';
  end if;
  if v_room.host_id <> p_actor then raise exception 'HOST_REQUIRED'; end if;
  if v_room.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if v_room.status <> 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;
  if v_room.expires_at <= clock_timestamp() then raise exception 'ROOM_EXPIRED'; end if;
  if (select count(*) from private.room_members where room_id = p_room_id) <> 2 then
    raise exception 'TWO_PLAYERS_REQUIRED';
  end if;
  select * into v_game from public.games where slug = p_game_slug;
  if not found or v_game.availability = 'coming_soon' then raise exception 'GAME_NOT_READY'; end if;

  update private.rooms
  set game_slug = p_game_slug, config = p_config, version = version + 1
  where id = p_room_id
  returning version into v_version;
  update private.room_members set ready = true where room_id = p_room_id;
  perform private.refresh_room_views(p_room_id);

  v_response := jsonb_build_object(
    'roomId', p_room_id,
    'version', v_version,
    'gameSlug', p_game_slug,
    'config', p_config
  );
  insert into private.room_command_receipts (
    room_id, command_id, actor_id, action_type, payload_hash, committed_version, response
  ) values (
    p_room_id, p_command_id, p_actor, 'PREPARE_MATCH', v_hash, v_version, v_response
  );
  return v_response;
end;
$$;

revoke all on function public.server_prepare_lobby_match(uuid, uuid, uuid, bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.server_prepare_lobby_match(uuid, uuid, uuid, bigint, text, jsonb) to service_role;
