-- tibo.fun — self-service signup and automatic account admission
-- User decision (12/09/2026): email/password signup is open; invitations are
-- no longer required for a usable account. Profiles contain no email address.

create or replace function private.pseudo_key(p_pseudo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(btrim(p_pseudo), '[[:space:]]+', ' ', 'g'));
$$;

create or replace function private.signup_pseudo_base(
  p_requested_pseudo text,
  p_email text,
  p_actor uuid
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_raw text;
  v_clean text;
  v_fallback text := 'Joueur-' || left(replace(p_actor::text, '-', ''), 8);
begin
  v_raw := nullif(btrim(p_requested_pseudo), '');
  if v_raw is null then
    v_raw := nullif(btrim(split_part(coalesce(p_email, ''), '@', 1)), '');
  end if;

  v_clean := btrim(regexp_replace(coalesce(v_raw, ''), '[^[:alnum:] _-]+', '', 'g'));
  v_clean := regexp_replace(v_clean, '[[:space:]]+', ' ', 'g');
  if char_length(v_clean) < 2 then
    v_clean := v_fallback;
  end if;
  v_clean := left(v_clean, 24);
  if char_length(v_clean) < 2 then
    v_clean := left(v_fallback, 24);
  end if;
  return v_clean;
end;
$$;

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

  select u.email into v_email
  from auth.users u
  where u.id = p_actor;
  if not found then
    raise exception 'ACCOUNT_NOT_FOUND';
  end if;
  v_email := coalesce(v_email, p_email);
  v_base := private.signup_pseudo_base(p_requested_pseudo, v_email, p_actor);

  select * into v_profile
  from public.profiles p
  where p.id = p_actor;

  if not found then
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
          -- A concurrent signup may have provisioned this same Auth user.
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

  -- Do not re-enable an account that an administrator deliberately disabled.
  select sm.status into v_membership_status
  from private.site_members sm
  where sm.user_id = p_actor;
  if v_membership_status = 'disabled' then
    raise exception 'ACCOUNT_DISABLED';
  end if;
  insert into private.site_members (user_id, role, status)
  values (p_actor, 'member', 'active')
  on conflict (user_id) do nothing;

  return jsonb_build_object(
    'id', v_profile.id,
    'pseudo', v_profile.pseudo,
    'avatarPreset', v_profile.avatar_preset,
    'avatarPath', v_profile.avatar_path
  );
end;
$$;

create or replace function public.server_provision_account(
  p_actor uuid,
  p_requested_pseudo text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.provision_account(p_actor, p_requested_pseudo, null);
$$;

revoke all on function private.pseudo_key(text) from public, anon, authenticated;
revoke all on function private.signup_pseudo_base(text, text, uuid) from public, anon, authenticated;
revoke all on function private.provision_account(uuid, text, text) from public, anon, authenticated;
revoke all on function public.server_provision_account(uuid, text) from public, anon, authenticated;
grant execute on function private.provision_account(uuid, text, text) to service_role;
grant execute on function public.server_provision_account(uuid, text) to service_role;

create or replace function private.provision_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.provision_account(
    new.id,
    new.raw_user_meta_data ->> 'pseudo',
    new.email
  );
  return new;
end;
$$;

revoke all on function private.provision_new_auth_user() from public, anon, authenticated;
grant execute on function private.provision_new_auth_user() to service_role;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    execute 'grant execute on function private.provision_new_auth_user() to supabase_auth_admin';
  end if;
end;
$$;

drop trigger if exists auth_user_provision_account on auth.users;
create trigger auth_user_provision_account
after insert on auth.users
for each row execute function private.provision_new_auth_user();

-- Backfill Auth users created before self-service signup was enabled. Existing
-- profiles, pseudoes and disabled memberships are preserved.
do $$
declare
  v_user record;
begin
  for v_user in
    select u.id, u.email
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null
  loop
    perform private.provision_account(v_user.id, null, v_user.email);
  end loop;
end;
$$;
