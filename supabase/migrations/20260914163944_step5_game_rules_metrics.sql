-- tibo.fun — étape 5 : règles de sortie, triggers coopératifs et métriques.
--
-- Cette migration est additive. Les migrations Compatibilité et Longueur
-- d'onde déjà appliquées restent immuables ; leurs fonctions/triggers sont
-- remplacés ici avec des noms de variables non ambigus et des jointures
-- explicites.

create or replace function private.merge_game_metrics(
  p_game_slug text,
  p_current jsonb,
  p_incoming jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_current jsonb := case when jsonb_typeof(coalesce(p_current, '{}'::jsonb)) = 'object' then coalesce(p_current, '{}'::jsonb) else '{}'::jsonb end;
  v_incoming jsonb := case when jsonb_typeof(coalesce(p_incoming, '{}'::jsonb)) = 'object' then coalesce(p_incoming, '{}'::jsonb) else '{}'::jsonb end;
  v_result jsonb := v_current;
  v_key text;
  v_nested_key text;
  v_value jsonb;
  v_nested jsonb;
  v_old numeric;
  v_new numeric;
  v_sum_keys text[] := array[
    'correct', 'incorrect', 'timeouts', 'contestsAccepted', 'questionsPlayed',
    'chosenLevelSum', 'answeredCount',
    'roundsPlayed', 'rawPointsSum', 'penalties', 'columnClears', 'automaticTurns',
    'validWords', 'responseTotalMs', 'responseCount',
    'shots', 'hits', 'misses', 'sunkShips', 'automaticShots', 'turns',
    'cardsPlayed', 'cardsDrawn', 'penaltyCardsTaken', 'missedAnnouncements',
    'cluesGiven', 'guessesMade', 'missedClues', 'missedGuesses', 'guessErrorSum', 'guessCount',
    'agreements', 'matches', 'compared', 'skipped',
    'distanceSumKm', 'validPlacements', 'missedPlacements',
    'rounds', 'maxRounds', 'turnsPlayed', 'validWordsTotal',
    'total', 'maxTotal', 'missed'
  ];
  v_last_keys text[] := array[
    'remainingCards', 'livesRemaining', 'category', 'seat', 'activeColor',
    'drawPileCount', 'packId', 'topCard', 'handValues', 'reserves', 'scores',
    'cumulative', 'lives', 'fleets', 'perPlayer'
  ];
begin
  if p_game_slug is null then return v_current; end if;

  foreach v_key in array v_sum_keys loop
    if jsonb_typeof(v_incoming -> v_key) = 'number' then
      v_new := (v_incoming ->> v_key)::numeric;
      v_old := case when jsonb_typeof(v_result -> v_key) = 'number' then (v_result ->> v_key)::numeric else 0 end;
      v_result := jsonb_set(v_result, array[v_key], to_jsonb(v_old + v_new), true);
    end if;
  end loop;

  foreach v_key in array array['correctByLevel', 'attemptsByLevel'] loop
    if jsonb_typeof(v_incoming -> v_key) <> 'object' then continue; end if;
    v_nested := case when jsonb_typeof(v_result -> v_key) = 'object' then v_result -> v_key else '{}'::jsonb end;
    for v_nested_key, v_value in select key, value from jsonb_each(v_incoming -> v_key) loop
      if jsonb_typeof(v_value) <> 'number' then continue; end if;
      v_new := (v_value #>> '{}')::numeric;
      v_old := case when jsonb_typeof(v_nested -> v_nested_key) = 'number' then (v_nested ->> v_nested_key)::numeric else 0 end;
      v_nested := jsonb_set(v_nested, array[v_nested_key], to_jsonb(v_old + v_new), true);
    end loop;
    v_result := jsonb_set(v_result, array[v_key], v_nested, true);
  end loop;

  foreach v_key in array v_last_keys loop
    if v_incoming ? v_key then
      v_result := jsonb_set(v_result, array[v_key], v_incoming -> v_key, true);
    end if;
  end loop;

  if jsonb_typeof(v_incoming -> 'shots') = 'array' then
    v_result := jsonb_set(v_result, array['shots'], v_incoming -> 'shots', true);
  end if;

  if jsonb_typeof(v_incoming -> 'bestDistanceKm') = 'number' then
    v_new := (v_incoming ->> 'bestDistanceKm')::numeric;
    if jsonb_typeof(v_result -> 'bestDistanceKm') <> 'number'
       or v_new < (v_result ->> 'bestDistanceKm')::numeric then
      v_result := jsonb_set(v_result, array['bestDistanceKm'], to_jsonb(v_new), true);
    end if;
  end if;

  if jsonb_typeof(v_incoming -> 'longestWordLength') = 'number' then
    v_new := (v_incoming ->> 'longestWordLength')::numeric;
    if jsonb_typeof(v_result -> 'longestWordLength') <> 'number'
       or v_new > (v_result ->> 'longestWordLength')::numeric then
      v_result := jsonb_set(v_result, array['longestWordLength'], to_jsonb(v_new), true);
    end if;
  end if;

  -- These fields are derived from retained sums/counts and must never be
  -- overwritten by the latest match's rounded display value.
  if jsonb_typeof(v_result -> 'chosenLevelSum') = 'number'
     and jsonb_typeof(v_result -> 'answeredCount') = 'number'
     and (v_result ->> 'answeredCount')::numeric > 0 then
    v_result := jsonb_set(v_result, array['averageLevel'], to_jsonb((v_result ->> 'chosenLevelSum')::numeric / (v_result ->> 'answeredCount')::numeric), true);
  elsif v_result ? 'averageLevel' then
    v_result := jsonb_set(v_result, array['averageLevel'], 'null'::jsonb, true);
  end if;

  if jsonb_typeof(v_result -> 'responseTotalMs') = 'number'
     and jsonb_typeof(v_result -> 'responseCount') = 'number'
     and (v_result ->> 'responseCount')::numeric > 0 then
    v_result := jsonb_set(v_result, array['meanAcceptedResponseMs'], to_jsonb(round((v_result ->> 'responseTotalMs')::numeric / (v_result ->> 'responseCount')::numeric)), true);
  end if;

  if jsonb_typeof(v_result -> 'hits') = 'number'
     and jsonb_typeof(v_result -> 'shots') = 'number'
     and (v_result ->> 'shots')::numeric > 0 then
    v_result := jsonb_set(v_result, array['precision'], to_jsonb((v_result ->> 'hits')::numeric / (v_result ->> 'shots')::numeric), true);
  end if;

  if jsonb_typeof(v_result -> 'guessErrorSum') = 'number'
     and jsonb_typeof(v_result -> 'guessCount') = 'number'
     and (v_result ->> 'guessCount')::numeric > 0 then
    v_result := jsonb_set(v_result, array['averageError'], to_jsonb(round((v_result ->> 'guessErrorSum')::numeric / (v_result ->> 'guessCount')::numeric)), true);
  elsif v_result ? 'averageError' then
    v_result := jsonb_set(v_result, array['averageError'], 'null'::jsonb, true);
  end if;

  if jsonb_typeof(v_result -> 'matches') = 'number'
     and jsonb_typeof(v_result -> 'compared') = 'number'
     and (v_result ->> 'compared')::numeric > 0 then
    v_result := jsonb_set(v_result, array['sharedScore'], to_jsonb(round(100 * (v_result ->> 'matches')::numeric / (v_result ->> 'compared')::numeric)), true);
  elsif p_game_slug = 'compatibilite' then
    v_result := jsonb_set(v_result, array['sharedScore'], 'null'::jsonb, true);
  end if;

  if jsonb_typeof(v_result -> 'total') = 'number'
     and jsonb_typeof(v_result -> 'maxTotal') = 'number'
     and (v_result ->> 'maxTotal')::numeric > 0 then
    v_result := jsonb_set(v_result, array['percentage'], to_jsonb(round(100 * (v_result ->> 'total')::numeric / (v_result ->> 'maxTotal')::numeric)), true);
  elsif p_game_slug = 'longueur-onde' then
    v_result := jsonb_set(v_result, array['percentage'], 'null'::jsonb, true);
  end if;

  return v_result;
end;
$$;

create or replace function private.rebuild_player_game_metrics(
  p_user_id uuid,
  p_game_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_metrics jsonb := '{}'::jsonb;
  v_row record;
begin
  for v_row in
    select pr.metrics
    from private.player_results as pr
    join private.matches as m on m.id = pr.match_id
    join private.match_results as mr on mr.match_id = pr.match_id
    where pr.user_id = p_user_id
      and m.game_slug = p_game_slug
    order by mr.completed_at, pr.match_id
  loop
    v_metrics := private.merge_game_metrics(p_game_slug, v_metrics, v_row.metrics);
  end loop;
  return v_metrics;
end;
$$;

create or replace function private.rebuild_pair_game_metrics(
  p_player_low uuid,
  p_player_high uuid,
  p_game_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_metrics jsonb := '{}'::jsonb;
  v_row record;
begin
  for v_row in
    select mr.summary
    from private.match_results as mr
    join private.matches as m on m.id = mr.match_id
    where m.game_slug = p_game_slug
      and exists (
        select 1 from private.match_players as mp
        where mp.match_id = mr.match_id and mp.user_id = p_player_low
      )
      and exists (
        select 1 from private.match_players as mp
        where mp.match_id = mr.match_id and mp.user_id = p_player_high
      )
    order by mr.completed_at, mr.match_id
  loop
    v_metrics := private.merge_game_metrics(p_game_slug, v_metrics, v_row.summary);
  end loop;
  return v_metrics;
end;
$$;

create or replace function private.refresh_player_game_stats_metrics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select
    count(*) filter (where pr.outcome in ('win', 'loss', 'draw', 'cooperative'))::integer,
    count(*) filter (where pr.outcome = 'win')::integer,
    count(*) filter (where pr.outcome = 'loss')::integer,
    count(*) filter (where pr.outcome = 'draw')::integer,
    count(*) filter (where pr.outcome = 'cooperative')::integer,
    count(*) filter (where pr.outcome = 'abandoned')::integer
  into new.played, new.wins, new.losses, new.draws, new.cooperative, new.abandoned
  from private.player_results as pr
  join private.matches as m on m.id = pr.match_id
  where pr.user_id = new.user_id
    and m.game_slug = new.game_slug;
  new.metrics := private.rebuild_player_game_metrics(new.user_id, new.game_slug);
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create or replace function private.refresh_pair_game_stats_metrics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select
    count(*) filter (where mr.outcome in ('win', 'draw', 'cooperative'))::integer,
    count(*) filter (where mr.outcome = 'win' and mr.winner_id = new.player_low)::integer,
    count(*) filter (where mr.outcome = 'win' and mr.winner_id = new.player_high)::integer,
    count(*) filter (where mr.outcome = 'draw')::integer,
    count(*) filter (where mr.outcome = 'cooperative')::integer,
    count(*) filter (where mr.outcome = 'abandoned')::integer
  into new.played, new.low_wins, new.high_wins, new.draws, new.cooperative, new.abandoned
  from private.match_results as mr
  join private.matches as m on m.id = mr.match_id
  where m.game_slug = new.game_slug
    and exists (
      select 1 from private.match_players as mp
      where mp.match_id = mr.match_id and mp.user_id = new.player_low
    )
    and exists (
      select 1 from private.match_players as mp
      where mp.match_id = mr.match_id and mp.user_id = new.player_high
    );
  new.metrics := private.rebuild_pair_game_metrics(new.player_low, new.player_high, new.game_slug);
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

-- The old player-stat normalizers tried to infer the latest match while the
-- common finalizer was still inserting its two player rows. They could turn
-- a cumulative row back into a single-game row. The refresh triggers above
-- use all retained player_results instead.
drop trigger if exists normalize_compat_player_stats on public.player_game_stats;
drop trigger if exists normalize_longueur_onde_player_stats on public.player_game_stats;
drop trigger if exists refresh_player_game_stats_metrics on public.player_game_stats;
create trigger refresh_player_game_stats_metrics
before insert or update on public.player_game_stats
for each row execute function private.refresh_player_game_stats_metrics();

drop trigger if exists refresh_pair_game_stats_metrics on private.pair_game_stats;
create trigger refresh_pair_game_stats_metrics
before insert or update on private.pair_game_stats
for each row execute function private.refresh_pair_game_stats_metrics();

create or replace function private.normalize_compat_player_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_slug text;
  v_result_kind text;
  v_result_outcome text;
begin
  select m.game_slug, mr.kind, mr.outcome
  into v_game_slug, v_result_kind, v_result_outcome
  from private.matches as m
  join private.match_results as mr on mr.match_id = m.id
  where m.id = new.match_id;
  if v_game_slug = 'compatibilite' and v_result_kind = 'cooperative' and v_result_outcome = 'cooperative' then
    new.outcome := 'cooperative';
    new.score := null;
  end if;
  return new;
end;
$$;

create or replace function private.normalize_compat_history_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_slug text;
  v_result_kind text;
  v_result_outcome text;
begin
  select m.game_slug, mr.kind, mr.outcome
  into v_game_slug, v_result_kind, v_result_outcome
  from private.matches as m
  join private.match_results as mr on mr.match_id = m.id
  where m.id = new.match_id;
  if v_game_slug = 'compatibilite' and v_result_kind = 'cooperative' and v_result_outcome = 'cooperative' then
    new.outcome := 'cooperative';
    new.score := null;
    new.opponent_score := null;
    new.shared_score := coalesce(new.shared_score, 0);
  end if;
  return new;
end;
$$;

-- Kept as a harmless compatibility entry point for old installations; it is
-- deliberately not attached to player_game_stats anymore.
create or replace function private.normalize_compat_player_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_slug text := new.game_slug;
begin
  if v_game_slug is null then return new; end if;
  return new;
end;
$$;

create or replace function private.record_compat_pair_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_slug text;
  v_low_id uuid;
  v_high_id uuid;
  v_played integer;
  v_cooperative integer;
  v_abandoned integer;
begin
  select m.game_slug into v_game_slug
  from private.matches as m
  where m.id = new.match_id;
  if v_game_slug is distinct from 'compatibilite' or new.kind <> 'cooperative' then return new; end if;

  select least(mp0.user_id, mp1.user_id), greatest(mp0.user_id, mp1.user_id)
  into v_low_id, v_high_id
  from private.match_players as mp0
  join private.match_players as mp1 on mp0.match_id = mp1.match_id
  where mp0.match_id = new.match_id and mp0.seat = 0 and mp1.seat = 1;

  v_played := case when new.outcome = 'cooperative' then 1 else 0 end;
  v_cooperative := v_played;
  v_abandoned := case when new.outcome = 'abandoned' then 1 else 0 end;
  insert into private.pair_game_stats (
    player_low, player_high, game_slug, played, low_wins, high_wins,
    draws, cooperative, abandoned, metrics
  )
  values (
    v_low_id, v_high_id, v_game_slug, v_played, 0, 0, 0, v_cooperative,
    v_abandoned, private.rebuild_pair_game_metrics(v_low_id, v_high_id, v_game_slug)
  )
  on conflict (player_low, player_high, game_slug) do update set
    played = private.pair_game_stats.played + excluded.played,
    cooperative = private.pair_game_stats.cooperative + excluded.cooperative,
    abandoned = private.pair_game_stats.abandoned + excluded.abandoned,
    metrics = private.rebuild_pair_game_metrics(private.pair_game_stats.player_low, private.pair_game_stats.player_high, private.pair_game_stats.game_slug),
    updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists normalize_compat_player_result on private.player_results;
create trigger normalize_compat_player_result
before insert on private.player_results
for each row execute function private.normalize_compat_player_result();
drop trigger if exists normalize_compat_history_entry on public.history_entries;
create trigger normalize_compat_history_entry
before insert on public.history_entries
for each row execute function private.normalize_compat_history_entry();
drop trigger if exists record_compat_pair_stats on private.match_results;
create trigger record_compat_pair_stats
after insert on private.match_results
for each row execute function private.record_compat_pair_stats();

create or replace function private.normalize_longueur_onde_player_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_slug text;
  v_result_kind text;
  v_result_outcome text;
begin
  select m.game_slug, mr.kind, mr.outcome
  into v_game_slug, v_result_kind, v_result_outcome
  from private.matches as m
  join private.match_results as mr on mr.match_id = m.id
  where m.id = new.match_id;
  if v_game_slug = 'longueur-onde' and v_result_kind = 'cooperative' and v_result_outcome = 'cooperative' then
    new.outcome := 'cooperative';
    new.score := null;
  end if;
  return new;
end;
$$;

create or replace function private.normalize_longueur_onde_history_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_slug text;
  v_result_kind text;
  v_result_outcome text;
begin
  select m.game_slug, mr.kind, mr.outcome
  into v_game_slug, v_result_kind, v_result_outcome
  from private.matches as m
  join private.match_results as mr on mr.match_id = m.id
  where m.id = new.match_id;
  if v_game_slug = 'longueur-onde' and v_result_kind = 'cooperative' and v_result_outcome = 'cooperative' then
    new.outcome := 'cooperative';
    new.score := null;
    new.opponent_score := null;
  end if;
  return new;
end;
$$;

create or replace function private.normalize_longueur_onde_player_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_slug text := new.game_slug;
begin
  if v_game_slug is null then return new; end if;
  return new;
end;
$$;

create or replace function private.record_longueur_onde_pair_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_slug text;
  v_low_id uuid;
  v_high_id uuid;
  v_played integer;
  v_cooperative integer;
  v_abandoned integer;
begin
  select m.game_slug into v_game_slug
  from private.matches as m
  where m.id = new.match_id;
  if v_game_slug is distinct from 'longueur-onde' or new.kind <> 'cooperative' then return new; end if;

  select least(mp0.user_id, mp1.user_id), greatest(mp0.user_id, mp1.user_id)
  into v_low_id, v_high_id
  from private.match_players as mp0
  join private.match_players as mp1 on mp0.match_id = mp1.match_id
  where mp0.match_id = new.match_id and mp0.seat = 0 and mp1.seat = 1;

  v_played := case when new.outcome = 'cooperative' then 1 else 0 end;
  v_cooperative := v_played;
  v_abandoned := case when new.outcome = 'abandoned' then 1 else 0 end;
  insert into private.pair_game_stats (
    player_low, player_high, game_slug, played, low_wins, high_wins,
    draws, cooperative, abandoned, metrics
  )
  values (
    v_low_id, v_high_id, v_game_slug, v_played, 0, 0, 0, v_cooperative,
    v_abandoned, private.rebuild_pair_game_metrics(v_low_id, v_high_id, v_game_slug)
  )
  on conflict (player_low, player_high, game_slug) do update set
    played = private.pair_game_stats.played + excluded.played,
    cooperative = private.pair_game_stats.cooperative + excluded.cooperative,
    abandoned = private.pair_game_stats.abandoned + excluded.abandoned,
    metrics = private.rebuild_pair_game_metrics(private.pair_game_stats.player_low, private.pair_game_stats.player_high, private.pair_game_stats.game_slug),
    updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists normalize_longueur_onde_player_result on private.player_results;
create trigger normalize_longueur_onde_player_result
before insert on private.player_results
for each row execute function private.normalize_longueur_onde_player_result();
drop trigger if exists normalize_longueur_onde_history_entry on public.history_entries;
create trigger normalize_longueur_onde_history_entry
before insert on public.history_entries
for each row execute function private.normalize_longueur_onde_history_entry();
drop trigger if exists record_longueur_onde_pair_stats on private.match_results;
create trigger record_longueur_onde_pair_stats
after insert on private.match_results
for each row execute function private.record_longueur_onde_pair_stats();

create or replace function private.rebuild_player_game_stats(
  p_user_id uuid,
  p_game_slug text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.player_game_stats (
    user_id, game_slug, played, wins, losses, draws, cooperative, abandoned, metrics
  )
  select
    p_user_id,
    p_game_slug,
    count(*) filter (where pr.outcome in ('win', 'loss', 'draw', 'cooperative'))::integer,
    count(*) filter (where pr.outcome = 'win')::integer,
    count(*) filter (where pr.outcome = 'loss')::integer,
    count(*) filter (where pr.outcome = 'draw')::integer,
    count(*) filter (where pr.outcome = 'cooperative')::integer,
    count(*) filter (where pr.outcome = 'abandoned')::integer,
    private.rebuild_player_game_metrics(p_user_id, p_game_slug)
  from private.player_results as pr
  join private.matches as m on m.id = pr.match_id
  where pr.user_id = p_user_id and m.game_slug = p_game_slug
  on conflict (user_id, game_slug) do update set
    played = excluded.played,
    wins = excluded.wins,
    losses = excluded.losses,
    draws = excluded.draws,
    cooperative = excluded.cooperative,
    abandoned = excluded.abandoned,
    metrics = excluded.metrics,
    updated_at = clock_timestamp();
end;
$$;

create or replace function private.rebuild_pair_game_stats(
  p_player_low uuid,
  p_player_high uuid,
  p_game_slug text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_player_low >= p_player_high then
    raise exception 'INVALID_PAIR';
  end if;
  insert into private.pair_game_stats (
    player_low, player_high, game_slug, played, low_wins, high_wins,
    draws, cooperative, abandoned, metrics
  )
  select
    p_player_low,
    p_player_high,
    p_game_slug,
    count(*) filter (where mr.outcome in ('win', 'draw', 'cooperative'))::integer,
    count(*) filter (where mr.outcome = 'win' and mr.winner_id = p_player_low)::integer,
    count(*) filter (where mr.outcome = 'win' and mr.winner_id = p_player_high)::integer,
    count(*) filter (where mr.outcome = 'draw')::integer,
    count(*) filter (where mr.outcome = 'cooperative')::integer,
    count(*) filter (where mr.outcome = 'abandoned')::integer,
    private.rebuild_pair_game_metrics(p_player_low, p_player_high, p_game_slug)
  from private.match_results as mr
  join private.matches as m on m.id = mr.match_id
  where m.game_slug = p_game_slug
    and exists (select 1 from private.match_players as mp where mp.match_id = mr.match_id and mp.user_id = p_player_low)
    and exists (select 1 from private.match_players as mp where mp.match_id = mr.match_id and mp.user_id = p_player_high)
  on conflict (player_low, player_high, game_slug) do update set
    played = excluded.played,
    low_wins = excluded.low_wins,
    high_wins = excluded.high_wins,
    draws = excluded.draws,
    cooperative = excluded.cooperative,
    abandoned = excluded.abandoned,
    metrics = excluded.metrics,
    updated_at = clock_timestamp();
end;
$$;

revoke all on function private.merge_game_metrics(text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.rebuild_player_game_metrics(uuid, text) from public, anon, authenticated;
revoke all on function private.rebuild_pair_game_metrics(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.refresh_player_game_stats_metrics() from public, anon, authenticated;
revoke all on function private.refresh_pair_game_stats_metrics() from public, anon, authenticated;
revoke all on function private.rebuild_player_game_stats(uuid, text) from public, anon, authenticated;
revoke all on function private.rebuild_pair_game_stats(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.normalize_compat_player_result() from public, anon, authenticated;
revoke all on function private.normalize_compat_history_entry() from public, anon, authenticated;
revoke all on function private.normalize_compat_player_stats() from public, anon, authenticated;
revoke all on function private.record_compat_pair_stats() from public, anon, authenticated;
revoke all on function private.normalize_longueur_onde_player_result() from public, anon, authenticated;
revoke all on function private.normalize_longueur_onde_history_entry() from public, anon, authenticated;
revoke all on function private.normalize_longueur_onde_player_stats() from public, anon, authenticated;
revoke all on function private.record_longueur_onde_pair_stats() from public, anon, authenticated;

grant execute on function private.rebuild_player_game_stats(uuid, text) to service_role;
grant execute on function private.rebuild_pair_game_stats(uuid, uuid, text) to service_role;
