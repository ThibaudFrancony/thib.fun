-- tibo.fun — profil : nom de création figé + nom affiché optionnel + bucket avatars
--
-- Décision produit (09/2026) : au signup on ne demande pas de pseudo.
-- À la première connexion, l'utilisateur choisit un pseudo unique qui ne
-- pourra plus être changé (account_name). Un second « nom affiché »
-- (display_name, nullable) peut ensuite remplacer l'affichage partout ;
-- vide = on affiche le nom de création.
-- L'avatar reste un WebP 256x256 privé (bucket `avatars`), URL signée courte.
--
-- Migration entièrement additive : aucune table existante n'est supprimée,
-- `pseudo`/`pseudo_key` sont conservés comme miroir de compatibilité.

-- ---------------------------------------------------------------------------
-- 1. Colonnes
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists account_name text,
  add column if not exists display_name text,
  add column if not exists display_name_key text;

-- Rattrapage : les comptes existants gardent leur pseudo comme nom de création.
update public.profiles set account_name = pseudo where account_name is null;

alter table public.profiles
  add constraint profiles_account_name_format check (
    account_name is null
    or (
      char_length(btrim(account_name)) between 2 and 24
      and account_name ~ '^[[:alnum:] _-]+$'
    )
  );

alter table public.profiles
  add constraint profiles_display_name_format check (
    display_name is null
    or (
      char_length(btrim(display_name)) between 2 and 24
      and display_name ~ '^[[:alnum:] _-]+$'
    )
  );

create unique index if not exists profiles_account_name_unique
  on public.profiles (account_name) where account_name is not null;

create unique index if not exists profiles_display_name_key_unique
  on public.profiles (display_name_key) where display_name_key is not null;

-- ---------------------------------------------------------------------------
-- 2. Triggers : clé display normalisée + gel du nom de création et du pseudo
-- ---------------------------------------------------------------------------

create or replace function private.profile_display_key(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name is null or btrim(p_name) = '' then null
    else lower(regexp_replace(btrim(p_name), '[[:space:]]+', ' ', 'g'))
  end;
$$;

create or replace function private.enforce_profile_names()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Normalise la clé d'unicité du nom affiché.
  new.display_name_key := private.profile_display_key(new.display_name);
  if new.display_name is not null and btrim(new.display_name) = '' then
    new.display_name := null;
    new.display_name_key := null;
  end if;

  -- Le nom de création ne peut être posé qu'une fois (NULL -> valeur).
  if old.account_name is not null
    and new.account_name is distinct from old.account_name then
    raise exception 'ACCOUNT_NAME_IMMUTABLE';
  end if;

  -- Le pseudo historique est gelé dès que le nom de création existe :
  -- il reste un miroir de compatibilité (mêmes lectures qu'avant).
  if old.account_name is not null
    and new.pseudo is distinct from old.pseudo then
    raise exception 'PSEUDO_IMMUTABLE';
  end if;

  -- Quand on pose le nom de création pour la première fois, le pseudo suit.
  if old.account_name is null and new.account_name is not null then
    new.pseudo := new.account_name;
    new.pseudo_key := private.pseudo_key(new.account_name);
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_names on public.profiles;
create trigger profiles_enforce_names
before update on public.profiles
for each row execute function private.enforce_profile_names();

revoke all on function private.profile_display_key(text) from public, anon, authenticated;
revoke all on function private.enforce_profile_names() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Provisionnement : les nouveaux comptes naissent sans nom de création
--    (NULL) pour déclencher l'onboarding « choisis ton pseudo » ; les invités
--    gardent un pseudo éphémère sans onboarding.
-- ---------------------------------------------------------------------------

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
          values (p_actor, v_candidate, v_key, v_candidate, 'orbit-1')
          returning * into v_profile;
        else
          -- Compte permanent : pseudo technique temporaire, nom de création
          -- NULL en attente du choix explicite (onboarding, choix unique).
          insert into public.profiles (id, pseudo, pseudo_key, account_name, avatar_preset)
          values (p_actor, v_candidate, v_key, null, 'orbit-1')
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

-- Le trigger d'insertion auth.users réutilise la même fonction (déjà en place).

-- ---------------------------------------------------------------------------
-- 4. Acteur serveur : expose les nouveaux champs (service_role uniquement)
-- ---------------------------------------------------------------------------

create or replace function public.server_get_actor(p_actor uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'pseudo', coalesce(p.display_name, p.account_name, p.pseudo),
    'accountName', p.account_name,
    'displayName', p.display_name,
    'effectiveName', coalesce(p.display_name, p.account_name, p.pseudo),
    'needsOnboarding', (p.account_name is null and not coalesce(sm.is_guest, false)),
    'avatarPreset', p.avatar_preset,
    'avatarPath', p.avatar_path,
    'isGuest', coalesce(sm.is_guest, false)
  )
  from public.profiles p
  join private.site_members sm on sm.user_id = p.id
  where p.id = p_actor and sm.status = 'active';
$$;

revoke all on function public.server_get_actor(uuid) from public, anon, authenticated;
grant execute on function public.server_get_actor(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Vues de salon : les membres portent le nom effectif + avatar
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 6. Snapshots de match : le pseudo_snapshot devient le nom effectif au start
--    + l'avatar_snapshot embarque le nom de création pour l'historique.
-- ---------------------------------------------------------------------------

-- Note : server_start_match est redéfini dans la migration Étape 11 ; on ne
-- duplique pas ses 100 lignes ici. Les workers/serveurs doivent construire
-- pseudo_snapshot = effective et avatar_snapshot = {preset, path, account}.
-- Pour les fonctions encore en place qui insèrent directement, on sécurise
-- via un trigger qui normalise à l'écriture.

create or replace function private.normalize_match_player_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
begin
  select * into v_profile from public.profiles where id = new.user_id;
  if found then
    if new.pseudo_snapshot is null or btrim(new.pseudo_snapshot) = '' then
      new.pseudo_snapshot := coalesce(v_profile.display_name, v_profile.account_name, v_profile.pseudo);
    end if;
    if new.avatar_snapshot is null or new.avatar_snapshot = '{}'::jsonb then
      new.avatar_snapshot := jsonb_build_object(
        'preset', v_profile.avatar_preset,
        'path', v_profile.avatar_path,
        'account', v_profile.account_name
      );
    elsif not (new.avatar_snapshot ? 'account') then
      new.avatar_snapshot := new.avatar_snapshot || jsonb_build_object('account', v_profile.account_name);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists match_players_normalize_snapshot on private.match_players;
create trigger match_players_normalize_snapshot
before insert on private.match_players
for each row execute function private.normalize_match_player_snapshot();

revoke all on function private.normalize_match_player_snapshot() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Bucket avatars privé (les politiques restent : aucun accès direct,
--    seul service_role via l'API serveur avec URLs signées courtes).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;
