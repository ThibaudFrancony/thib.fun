-- tibo.fun — la projection salon garde hôte et échéance (Étape 8).
--
-- Correctif de 20260918191811 : sa redéfinition de private.refresh_room_views
-- avait perdu 'hostId' et 'expiresAt' du payload, exigés par la recette pgTAP
-- de l'Étape 8. Les champs de profil enrichis sont conservés.

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
        'pseudo', coalesce(p.display_name, p.account_name, p.pseudo),
        'accountName', p.account_name,
        'displayName', p.display_name,
        'avatarPreset', p.avatar_preset,
        'avatarPath', p.avatar_path,
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

revoke all on function private.refresh_room_views(uuid) from public, anon, authenticated;
grant execute on function private.refresh_room_views(uuid) to service_role;
