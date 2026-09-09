-- tibo.fun — immutable content packs, rooms and matches

create table if not exists private.content_packs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (
    kind in ('quiz', 'geography', 'words', 'compatibility', 'spectrums')
  ),
  slug text not null,
  version integer not null check (version > 0),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'retired')),
  manifest jsonb not null default '{}'::jsonb
    check (jsonb_typeof(manifest) = 'object'),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint content_packs_identity unique (kind, slug, version),
  constraint content_packs_publication_date check (
    status <> 'published' or published_at is not null
  )
);

create index if not exists content_packs_lookup_idx
  on private.content_packs (kind, slug, status, version desc);

create table if not exists private.content_items (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references private.content_packs (id) on delete restrict,
  logical_key text not null,
  category text,
  difficulty smallint,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  constraint content_items_identity unique (pack_id, logical_key)
);

create index if not exists content_items_pack_filter_idx
  on private.content_items (pack_id, category, difficulty);

create table if not exists private.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references public.profiles (id) on delete restrict,
  game_slug text not null references public.games (slug) on delete restrict,
  config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(config) = 'object'),
  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'closed')),
  version bigint not null default 0 check (version >= 0),
  current_match_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint rooms_code_format check (
    code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'
  )
);

create index if not exists rooms_host_status_idx
  on private.rooms (host_id, status, updated_at desc);

create table if not exists private.room_members (
  room_id uuid not null references private.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete restrict,
  seat smallint not null check (seat in (0, 1)),
  ready boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (room_id, user_id),
  constraint room_members_seat_unique unique (room_id, seat)
);

create index if not exists room_members_user_idx
  on private.room_members (user_id, last_seen_at desc);

create table if not exists private.matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references private.rooms (id) on delete restrict,
  game_slug text not null references public.games (slug) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'completed', 'abandoned')),
  mode text not null check (mode in ('random', 'challenge')),
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  rules_version text not null,
  engine_version text not null,
  state_schema_version integer not null check (state_schema_version > 0),
  content_manifest jsonb not null
    check (jsonb_typeof(content_manifest) = 'object'),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  version bigint not null default 0 check (version >= 0),
  phase_id uuid not null default gen_random_uuid(),
  deadline_at timestamptz,
  deadline_kind text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text,
  created_at timestamptz not null default now(),
  constraint matches_deadline_pair check (
    (deadline_at is null) = (deadline_kind is null)
  ),
  constraint matches_status_dates check (
    (status = 'active' and ended_at is null)
    or (status <> 'active' and ended_at is not null)
  )
);

create unique index if not exists matches_one_active_per_room_idx
  on private.matches (room_id)
  where status = 'active';

create index if not exists matches_due_active_idx
  on private.matches (status, deadline_at)
  where status = 'active' and deadline_at is not null;

create table if not exists private.match_players (
  match_id uuid not null references private.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete restrict,
  seat smallint not null check (seat in (0, 1)),
  pseudo_snapshot text not null,
  avatar_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(avatar_snapshot) = 'object'),
  last_seen_at timestamptz not null default now(),
  primary key (match_id, user_id),
  constraint match_players_seat_unique unique (match_id, seat)
);

create index if not exists match_players_user_idx
  on private.match_players (user_id, last_seen_at desc);

alter table private.rooms
  add constraint rooms_current_match_fk
  foreign key (current_match_id) references private.matches (id) on delete set null;

drop trigger if exists rooms_touch_updated_at on private.rooms;
create trigger rooms_touch_updated_at
before update on private.rooms
for each row execute function private.touch_updated_at();

revoke all on all tables in schema private from anon, authenticated;
revoke all on all sequences in schema private from anon, authenticated;
