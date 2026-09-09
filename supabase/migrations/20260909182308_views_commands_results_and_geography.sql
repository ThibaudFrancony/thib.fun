-- tibo.fun — private projections, durable commands/jobs and results

create table if not exists public.room_views (
  room_id uuid not null references private.rooms (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete restrict,
  version bigint not null check (version >= 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (room_id, viewer_id)
);

create index if not exists room_views_viewer_updated_idx
  on public.room_views (viewer_id, updated_at desc);

create table if not exists public.match_views (
  match_id uuid not null references private.matches (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete restrict,
  version bigint not null check (version >= 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (match_id, viewer_id)
);

create index if not exists match_views_viewer_updated_idx
  on public.match_views (viewer_id, updated_at desc);

create table if not exists private.command_receipts (
  match_id uuid not null references private.matches (id) on delete cascade,
  command_id uuid not null,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  action_type text not null,
  payload_hash text not null,
  committed_version bigint not null check (committed_version >= 1),
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  created_at timestamptz not null default now(),
  primary key (match_id, command_id)
);

create index if not exists command_receipts_actor_created_idx
  on private.command_receipts (actor_id, created_at desc);

create table if not exists private.room_command_receipts (
  room_id uuid not null references private.rooms (id) on delete cascade,
  command_id uuid not null,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  action_type text not null,
  payload_hash text not null,
  committed_version bigint not null check (committed_version >= 1),
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  created_at timestamptz not null default now(),
  primary key (room_id, command_id)
);

create table if not exists private.request_receipts (
  actor_id uuid not null references public.profiles (id) on delete restrict,
  request_id uuid not null,
  route text not null,
  payload_hash text not null,
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  created_at timestamptz not null default now(),
  primary key (actor_id, request_id)
);

create table if not exists private.match_events (
  id bigint generated always as identity primary key,
  match_id uuid not null references private.matches (id) on delete cascade,
  version bigint not null check (version >= 1),
  event_type text not null,
  actor_id uuid references public.profiles (id) on delete restrict,
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  constraint match_events_version_unique unique (match_id, version)
);

create index if not exists match_events_match_created_idx
  on private.match_events (match_id, created_at desc);

create table if not exists private.jobs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references private.matches (id) on delete cascade,
  kind text not null,
  phase_id uuid,
  dedupe_key text not null unique,
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  run_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'cancelled', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  lease_token uuid,
  lease_until timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint jobs_lease_pair check (
    (lease_token is null) = (lease_until is null)
  )
);

create index if not exists jobs_pending_run_idx
  on private.jobs (run_at)
  where status = 'pending';

create index if not exists jobs_running_lease_idx
  on private.jobs (lease_until)
  where status = 'running';

create index if not exists jobs_match_status_idx
  on private.jobs (match_id, status);

create table if not exists private.job_receipts (
  job_id uuid primary key references private.jobs (id) on delete cascade,
  payload_hash text not null,
  committed_version bigint not null check (committed_version >= 1),
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists private.round_results (
  match_id uuid not null references private.matches (id) on delete cascade,
  round_no integer not null check (round_no > 0),
  summary jsonb not null check (jsonb_typeof(summary) = 'object'),
  completed_at timestamptz not null default now(),
  primary key (match_id, round_no)
);

create table if not exists private.match_results (
  match_id uuid primary key references private.matches (id) on delete restrict,
  kind text not null check (kind in ('competitive', 'cooperative')),
  outcome text not null check (outcome in ('win', 'draw', 'cooperative', 'abandoned')),
  winner_id uuid references public.profiles (id) on delete restrict,
  shared_score numeric,
  summary jsonb not null default '{}'::jsonb
    check (jsonb_typeof(summary) = 'object'),
  reason text not null check (
    reason in (
      'normal', 'round_limit', 'turn_limit', 'blocked',
      'dictionary_exhausted', 'resign', 'claimed_forfeit',
      'absence', 'judging_unavailable', 'technical_error'
    )
  ),
  completed_at timestamptz not null default now(),
  constraint match_results_winner_consistency check (
    (outcome = 'win' and winner_id is not null)
    or (outcome <> 'win' and winner_id is null)
  ),
  constraint match_results_shared_score_consistency check (
    (kind = 'cooperative' and shared_score is not null)
    or (kind = 'competitive' and shared_score is null)
  )
);

create table if not exists private.player_results (
  match_id uuid not null references private.match_results (match_id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete restrict,
  outcome text not null check (outcome in ('win', 'loss', 'draw', 'cooperative', 'abandoned')),
  score numeric,
  metrics jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metrics) = 'object'),
  primary key (match_id, user_id)
);

create index if not exists player_results_user_idx
  on private.player_results (user_id, match_id);

create table if not exists public.history_entries (
  viewer_id uuid not null references public.profiles (id) on delete restrict,
  match_id uuid not null references private.matches (id) on delete restrict,
  opponent_id uuid not null references public.profiles (id) on delete restrict,
  game_slug text not null references public.games (slug) on delete restrict,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  outcome text not null check (outcome in ('win', 'loss', 'draw', 'cooperative', 'abandoned')),
  score numeric,
  opponent_score numeric,
  shared_score numeric,
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  primary key (viewer_id, match_id)
);

create index if not exists history_entries_viewer_ended_idx
  on public.history_entries (viewer_id, ended_at desc, match_id desc);

create index if not exists history_entries_duo_game_idx
  on public.history_entries (viewer_id, opponent_id, game_slug, ended_at desc);

create table if not exists public.player_game_stats (
  user_id uuid not null references public.profiles (id) on delete restrict,
  game_slug text not null references public.games (slug) on delete restrict,
  played integer not null default 0 check (played >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  cooperative integer not null default 0 check (cooperative >= 0),
  abandoned integer not null default 0 check (abandoned >= 0),
  metrics jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metrics) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_slug),
  constraint player_game_stats_played_consistency check (
    played = wins + losses + draws + cooperative
  )
);

create table if not exists private.pair_game_stats (
  player_low uuid not null references public.profiles (id) on delete restrict,
  player_high uuid not null references public.profiles (id) on delete restrict,
  game_slug text not null references public.games (slug) on delete restrict,
  played integer not null default 0 check (played >= 0),
  low_wins integer not null default 0 check (low_wins >= 0),
  high_wins integer not null default 0 check (high_wins >= 0),
  draws integer not null default 0 check (draws >= 0),
  cooperative integer not null default 0 check (cooperative >= 0),
  abandoned integer not null default 0 check (abandoned >= 0),
  metrics jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metrics) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (player_low, player_high, game_slug),
  constraint pair_game_stats_player_order check (player_low < player_high),
  constraint pair_game_stats_played_consistency check (
    played = low_wins + high_wins + draws + cooperative
  )
);

alter table public.room_views enable row level security;
alter table public.match_views enable row level security;
alter table public.history_entries enable row level security;
alter table public.player_game_stats enable row level security;

revoke all on table
  public.room_views,
  public.match_views,
  public.history_entries,
  public.player_game_stats
from anon, authenticated;

grant select on table
  public.room_views,
  public.match_views,
  public.history_entries,
  public.player_game_stats
to authenticated;

drop policy if exists room_views_owner_read on public.room_views;
create policy room_views_owner_read
on public.room_views
for select
to authenticated
using (
  (select public.is_site_member())
  and viewer_id = (select auth.uid())
);

drop policy if exists match_views_owner_read on public.match_views;
create policy match_views_owner_read
on public.match_views
for select
to authenticated
using (
  (select public.is_site_member())
  and viewer_id = (select auth.uid())
);

drop policy if exists history_entries_owner_read on public.history_entries;
create policy history_entries_owner_read
on public.history_entries
for select
to authenticated
using (
  (select public.is_site_member())
  and viewer_id = (select auth.uid())
);

drop policy if exists player_game_stats_member_read on public.player_game_stats;
create policy player_game_stats_member_read
on public.player_game_stats
for select
to authenticated
using ((select public.is_site_member()));

-- All private objects remain inaccessible through the Data API. Server-side
-- routes will use restricted RPCs once the application layer is implemented.
revoke all on all tables in schema private from anon, authenticated;
revoke all on all sequences in schema private from anon, authenticated;
