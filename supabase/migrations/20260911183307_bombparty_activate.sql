-- BombParty uses the existing match/room JSON state contract; this migration only
-- makes the versioned game startable after the application code is deployed,
-- and exposes a server-only helper so training routes can refuse assistance
-- while the same account has an active BombParty match.
update public.games
set availability = 'ready', rules_version = 'bombparty-1'
where slug = 'bombparty';

create or replace function public.server_has_active_match(p_actor uuid, p_slug text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'active',
    exists(
      select 1
      from private.matches m
      join private.match_players p on p.match_id = m.id
      where m.status = 'active'
        and m.game_slug = p_slug
        and p.user_id = p_actor
    )
  );
$$;

revoke all on function public.server_has_active_match(uuid, text) from public, anon, authenticated;
grant execute on function public.server_has_active_match(uuid, text) to service_role;
