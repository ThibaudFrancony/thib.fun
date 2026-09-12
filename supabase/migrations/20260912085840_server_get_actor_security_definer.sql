-- tibo.fun — allow the server-only actor projection to inspect auth.users.
-- The function is callable only by service_role and does not expose auth data
-- to client roles.
create or replace function public.server_get_actor(p_actor uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'pseudo', p.pseudo,
    'avatarPreset', p.avatar_preset,
    'avatarPath', p.avatar_path,
    'isGuest', exists (
      select 1 from auth.users u
      where u.id = p.id and coalesce(u.is_anonymous, false)
    )
  )
  from public.profiles p
  join private.site_members sm on sm.user_id = p.id
  where p.id = p_actor and sm.status = 'active';
$$;

revoke all on function public.server_get_actor(uuid) from public, anon, authenticated;
grant execute on function public.server_get_actor(uuid) to service_role;
