-- tibo.fun — le preset d'avatar par défaut suit les PNG avatar-1..avatar-10.
--
-- Correctif de 20260918191811 : private.provision_account insérait encore
-- 'orbit-1', rejeté par la nouvelle contrainte profiles_avatar_preset.
-- Les invités et les comptes permanents naissent désormais en 'avatar-1'.

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
        if v_is_guest then
          insert into public.profiles (id, pseudo, pseudo_key, account_name, avatar_preset)
          values (p_actor, v_candidate, v_key, v_candidate, 'avatar-1')
          returning * into v_profile;
        else
          insert into public.profiles (id, pseudo, pseudo_key, account_name, avatar_preset)
          values (p_actor, v_candidate, v_key, null, 'avatar-1')
          returning * into v_profile;
        end if;
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
    'accountName', v_profile.account_name,
    'displayName', v_profile.display_name,
    'effectiveName', coalesce(v_profile.display_name, v_profile.account_name, v_profile.pseudo),
    'needsOnboarding', (v_profile.account_name is null and not v_is_guest),
    'avatarPreset', v_profile.avatar_preset,
    'avatarPath', v_profile.avatar_path,
    'isGuest', v_is_guest
  );
end;
$$;

revoke all on function private.provision_account(uuid, text, text) from public, anon, authenticated;
grant execute on function private.provision_account(uuid, text, text) to service_role;
