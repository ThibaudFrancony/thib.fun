-- tibo.fun — foundation, identities and game registry
-- This migration is intentionally additive and contains no production data.

create extension if not exists "pgcrypto" with schema extensions;

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to service_role;

alter default privileges for role postgres in schema private
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema private
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema private
  revoke all on functions from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  pseudo text not null,
  pseudo_key text not null unique,
  avatar_path text,
  avatar_preset text not null default 'orbit-1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_pseudo_format check (
    char_length(btrim(pseudo)) between 2 and 24
    and pseudo ~ '^[[:alnum:] _-]+$'
  ),
  constraint profiles_avatar_preset check (
    avatar_preset in (
      'orbit-1', 'orbit-2', 'orbit-3', 'orbit-4',
      'orbit-5', 'orbit-6', 'orbit-7', 'orbit-8'
    )
  )
);

create index if not exists profiles_pseudo_key_idx on public.profiles (pseudo_key);

create table if not exists private.site_members (
  user_id uuid primary key references auth.users (id) on delete restrict,
  role text not null default 'member' check (role in ('member', 'admin')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now()
);

create table if not exists private.invitations (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  email_key text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  expires_at timestamptz not null,
  max_uses integer not null default 1 check (max_uses between 1 and 10),
  used_count integer not null default 0 check (used_count >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invitations_use_limit check (used_count <= max_uses)
);

create index if not exists invitations_expiry_idx
  on private.invitations (expires_at)
  where revoked_at is null;

create table if not exists public.games (
  slug text primary key,
  display_name text not null,
  description text not null,
  priority smallint not null check (priority between 0 and 9),
  kind text not null check (kind in ('competitive', 'cooperative')),
  availability text not null default 'coming_soon'
    check (availability in ('coming_soon', 'beta', 'ready')),
  rules_version text not null,
  created_at timestamptz not null default now()
);

insert into public.games (
  slug, display_name, description, priority, kind, availability, rules_version
)
values
  ('trou-noir', 'Chute libre', 'Réponds juste pour éviter la chute.', 0, 'competitive', 'coming_soon', 'trou-noir-v1'),
  ('ttmc', 'À ton niveau', 'Choisis ta difficulté et mise sur tes connaissances.', 1, 'competitive', 'coming_soon', 'ttmc-v1'),
  ('geographie', 'HexaPoint', 'Place les villes au plus près sur la carte.', 2, 'competitive', 'coming_soon', 'geographie-v1'),
  ('skyjo', 'Douze cases', 'Révèle et échange tes cartes pour réduire ton total.', 3, 'competitive', 'coming_soon', 'skyjo-v1'),
  ('uno', 'Dernière carte', 'Débarrasse-toi de ta main avant ton adversaire.', 4, 'competitive', 'coming_soon', 'uno-v1'),
  ('bombparty', 'Syllabe Express', 'Trouve le bon mot avant la fin du chrono.', 5, 'competitive', 'coming_soon', 'bombparty-v1'),
  ('bataille-navale', 'Flotte cachée', 'Repère et coule la flotte adverse.', 6, 'competitive', 'coming_soon', 'bataille-navale-v1'),
  ('compatibilite', 'Même réponse ?', 'Comparez vos choix et découvrez vos points communs.', 7, 'cooperative', 'coming_soon', 'compatibilite-v1'),
  ('longueur-onde', 'À l’unisson', 'Donne un indice et trouvez la même longueur d’onde.', 8, 'cooperative', 'coming_soon', 'longueur-onde-v1')
on conflict (slug) do nothing;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function private.touch_updated_at();

create or replace function public.is_site_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.site_members as sm
    where sm.user_id = (select auth.uid())
      and sm.status = 'active'
  );
$$;

revoke execute on function public.is_site_member() from public, anon;
grant execute on function public.is_site_member() to authenticated;

alter table public.profiles enable row level security;
alter table public.games enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.games from anon, authenticated;
grant select on table public.profiles, public.games to authenticated;

drop policy if exists profiles_member_read on public.profiles;
create policy profiles_member_read
on public.profiles
for select
to authenticated
using ((select public.is_site_member()));

drop policy if exists games_member_read on public.games;
create policy games_member_read
on public.games
for select
to authenticated
using ((select public.is_site_member()));
