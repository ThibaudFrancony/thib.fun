-- tibo.fun — keep guest status in the private membership projection.
-- Invoker RPCs must not read auth.users: service_role can execute them but does
-- not receive SELECT on Supabase's auth schema.

alter table private.site_members
  add column if not exists is_guest boolean not null default false;

update private.site_members sm
set is_guest = exists (
  select 1
  from auth.users u
  where u.id = sm.user_id
    and coalesce(u.is_anonymous, false)
);

create or replace function private.provision_account(
  p_actor uuid,
  p_requested_pseudo text default null,
  p_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_is_guest boolean := false;
  v_base text;
  v_candidate text;
  v_key text;
  v_suffix text;
  v_attempt integer := 0;
  v_membership_status text;
  v_profile public.profiles%rowtype;
begin
  if p_actor is null then
    raise exception 'ACCOUNT_ACTOR_REQUIRED';
  end if;

  select u.email, coalesce(u.is_anonymous, false)
    into v_email, v_is_guest
  from auth.users u
  where u.id = p_actor;
  if not found then
    raise exception 'ACCOUNT_NOT_FOUND';
  end if;
  v_email := coalesce(v_email, p_email);

  select * into v_profile
  from public.profiles p
  where p.id = p_actor;

  if not found then
    if v_is_guest then
      v_base := private.guest_pseudo();
    else
      v_base := private.signup_pseudo_base(p_requested_pseudo, v_email, p_actor);
    end if;
    loop
      if v_attempt = 0 then
        v_candidate := v_base;
      else
        v_suffix := v_attempt::text;
        v_candidate := left(v_base, 24 - char_length(v_suffix) - 1) || '-' || v_suffix;
      end if;
      v_key := private.pseudo_key(v_candidate);

      begin
        insert into public.profiles (id, pseudo, pseudo_key, avatar_preset)
        values (p_actor, v_candidate, v_key, 'orbit-1')
        returning * into v_profile;
        exit;
      exception
        when unique_violation then
          if exists (select 1 from public.profiles p where p.id = p_actor) then
            select * into v_profile from public.profiles p where p.id = p_actor;
            exit;
          end if;
          v_attempt := v_attempt + 1;
          if v_attempt > 100 then
            raise exception 'PROFILE_PSEUDO_UNAVAILABLE';
          end if;
      end;
    end loop;
  end if;

  -- Do not re-enable an account deliberately disabled by an administrator.
  select sm.status into v_membership_status
  from private.site_members sm
  where sm.user_id = p_actor;
  if v_membership_status = 'disabled' then
    raise exception 'ACCOUNT_DISABLED';
  end if;
  insert into private.site_members (user_id, role, status, is_guest)
  values (p_actor, 'member', 'active', v_is_guest)
  on conflict (user_id) do update
    set is_guest = excluded.is_guest;

  return jsonb_build_object(
    'id', v_profile.id,
    'pseudo', v_profile.pseudo,
    'avatarPreset', v_profile.avatar_preset,
    'avatarPath', v_profile.avatar_path,
    'isGuest', v_is_guest
  );
end;
$$;

revoke all on function private.provision_account(uuid, text, text) from public, anon, authenticated;
grant execute on function private.provision_account(uuid, text, text) to service_role;

create or replace function public.server_get_actor(p_actor uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'pseudo', p.pseudo,
    'avatarPreset', p.avatar_preset,
    'avatarPath', p.avatar_path,
    'isGuest', sm.is_guest
  )
  from public.profiles p
  join private.site_members sm on sm.user_id = p.id
  where p.id = p_actor and sm.status = 'active';
$$;

revoke all on function public.server_get_actor(uuid) from public, anon, authenticated;
grant execute on function public.server_get_actor(uuid) to service_role;

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
    'gameSlug', v_room.game_slug,
    'config', v_room.config,
    'status', v_room.status,
    'version', v_room.version,
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

revoke all on function private.refresh_room_views(uuid) from public, anon, authenticated;
grant execute on function private.refresh_room_views(uuid) to service_role;

create or replace function public.server_get_match(p_actor uuid, p_match_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'matchId', m.id,
    'roomId', m.room_id,
    'gameSlug', m.game_slug,
    'status', m.status,
    'mode', m.mode,
    'config', m.config,
    'rulesVersion', m.rules_version,
    'engineVersion', m.engine_version,
    'stateSchemaVersion', m.state_schema_version,
    'version', m.version,
    'phaseId', m.phase_id,
    'deadlineAt', m.deadline_at,
    'deadlineKind', m.deadline_kind,
    'startedAt', m.started_at,
    'players', (
      select jsonb_agg(jsonb_build_object(
        'id', mp.user_id,
        'seat', mp.seat,
        'pseudo', mp.pseudo_snapshot,
        'avatar', mp.avatar_snapshot,
        'isGuest', coalesce(sm_player.is_guest, false),
        'lastSeenAt', mp.last_seen_at
      ) order by mp.seat)
      from private.match_players mp
      left join private.site_members sm_player on sm_player.user_id = mp.user_id
      where mp.match_id = m.id
    ),
    'state', m.state,
    'view', mv.payload,
    'serverNow', clock_timestamp()
  )
  from private.matches m
  join private.match_players me on me.match_id = m.id and me.user_id = p_actor
  join private.site_members sm on sm.user_id = p_actor and sm.status = 'active'
  join public.match_views mv on mv.match_id = m.id and mv.viewer_id = p_actor
  where m.id = p_match_id;
$$;

revoke all on function public.server_get_match(uuid, uuid) from public, anon, authenticated;
grant execute on function public.server_get_match(uuid, uuid) to service_role;

create or replace function public.server_get_pair_history(
  p_actor uuid,
  p_opponent uuid,
  p_game text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'stats', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.game_slug)
      from private.pair_game_stats s
      where s.player_low = least(p_actor, p_opponent)
        and s.player_high = greatest(p_actor, p_opponent)
        and (p_game is null or s.game_slug = p_game)
    ), '[]'::jsonb),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'matchId', h.match_id,
        'opponentId', h.opponent_id,
        'gameSlug', h.game_slug,
        'startedAt', h.started_at,
        'endedAt', h.ended_at,
        'outcome', h.outcome,
        'score', h.score,
        'opponentScore', h.opponent_score,
        'sharedScore', h.shared_score,
        'payload', h.payload
      ) order by h.ended_at desc, h.match_id desc)
      from public.history_entries h
      where h.viewer_id = p_actor
        and h.opponent_id = p_opponent
        and (p_game is null or h.game_slug = p_game)
    ), '[]'::jsonb)
  )
  where exists (
    select 1 from private.site_members sm
    where sm.user_id = p_actor and sm.status = 'active'
  )
    and not exists (
      select 1 from private.site_members sm
      where sm.user_id = p_actor and sm.is_guest
    )
    and exists (
      select 1 from private.site_members sm
      where sm.user_id = p_opponent and sm.status = 'active'
    );
$$;

revoke all on function public.server_get_pair_history(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.server_get_pair_history(uuid, uuid, text) to service_role;
