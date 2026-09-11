-- Longueur d'onde was activated by the previous migration before its
-- cooperative result triggers were added to the versioned file. This
-- additive migration installs them without rewriting an applied migration.

create or replace function private.normalize_longueur_onde_player_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  game_slug text;
  result_kind text;
  result_outcome text;
begin
  select m.game_slug, mr.kind, mr.outcome
  into game_slug, result_kind, result_outcome
  from private.matches m
  join private.match_results mr on mr.match_id = new.match_id
  where mr.match_id = new.match_id;

  if game_slug = 'longueur-onde' and result_kind = 'cooperative' and result_outcome = 'cooperative' then
    new.outcome := 'cooperative';
    new.score := null;
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_longueur_onde_player_result on private.player_results;
create trigger normalize_longueur_onde_player_result
before insert on private.player_results
for each row execute function private.normalize_longueur_onde_player_result();

create or replace function private.normalize_longueur_onde_history_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  game_slug text;
  result_kind text;
  result_outcome text;
begin
  select m.game_slug, mr.kind, mr.outcome
  into game_slug, result_kind, result_outcome
  from private.matches m
  join private.match_results mr on mr.match_id = new.match_id
  where m.id = new.match_id;

  if game_slug = 'longueur-onde' and result_kind = 'cooperative' and result_outcome = 'cooperative' then
    new.outcome := 'cooperative';
    new.score := null;
    new.opponent_score := null;
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_longueur_onde_history_entry on public.history_entries;
create trigger normalize_longueur_onde_history_entry
before insert on public.history_entries
for each row execute function private.normalize_longueur_onde_history_entry();

create or replace function private.normalize_longueur_onde_player_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  game_slug text;
  result_kind text;
  result_outcome text;
begin
  select m.game_slug, mr.kind, mr.outcome
  into game_slug, result_kind, result_outcome
  from private.matches m
  join private.match_results mr on mr.match_id = m.id
  join private.player_results pr on pr.match_id = mr.match_id and pr.user_id = new.user_id
  where m.game_slug = 'longueur-onde'
  order by mr.completed_at desc
  limit 1;

  if new.game_slug = 'longueur-onde' and result_kind = 'cooperative' and result_outcome = 'cooperative' then
    new.played := 1;
    new.wins := 0;
    new.losses := 0;
    new.draws := 0;
    new.cooperative := 1;
    new.abandoned := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_longueur_onde_player_stats on public.player_game_stats;
create trigger normalize_longueur_onde_player_stats
before insert on public.player_game_stats
for each row execute function private.normalize_longueur_onde_player_stats();

create or replace function private.record_longueur_onde_pair_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  game_slug text;
  low_id uuid;
  high_id uuid;
  played integer;
  cooperative integer;
  abandoned integer;
begin
  select m.game_slug into game_slug
  from private.matches m
  where m.id = new.match_id;

  if game_slug is distinct from 'longueur-onde' or new.kind <> 'cooperative' then
    return new;
  end if;

  select least(mp0.user_id, mp1.user_id), greatest(mp0.user_id, mp1.user_id)
  into low_id, high_id
  from private.match_players mp0
  join private.match_players mp1 on mp0.match_id = mp1.match_id
  where mp0.match_id = new.match_id
    and mp0.seat = 0
    and mp1.seat = 1;

  played := case when new.outcome = 'cooperative' then 1 else 0 end;
  cooperative := played;
  abandoned := case when new.outcome = 'abandoned' then 1 else 0 end;

  insert into private.pair_game_stats (
    player_low, player_high, game_slug, played, low_wins, high_wins,
    draws, cooperative, abandoned, metrics
  )
  values (
    low_id, high_id, game_slug, played, 0, 0, 0, cooperative, abandoned,
    coalesce(new.summary, '{}'::jsonb)
  )
  on conflict (player_low, player_high, game_slug) do update set
    played = private.pair_game_stats.played + excluded.played,
    cooperative = private.pair_game_stats.cooperative + excluded.cooperative,
    abandoned = private.pair_game_stats.abandoned + excluded.abandoned,
    metrics = private.pair_game_stats.metrics || excluded.metrics,
    updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists record_longueur_onde_pair_stats on private.match_results;
create trigger record_longueur_onde_pair_stats
after insert on private.match_results
for each row execute function private.record_longueur_onde_pair_stats();

revoke all on function private.normalize_longueur_onde_player_result() from public, anon, authenticated;
revoke all on function private.normalize_longueur_onde_history_entry() from public, anon, authenticated;
revoke all on function private.normalize_longueur_onde_player_stats() from public, anon, authenticated;
revoke all on function private.record_longueur_onde_pair_stats() from public, anon, authenticated;
