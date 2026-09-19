-- tibo.fun — points de classement inter-jeux.
--
-- Contenu, entièrement additif :
--   1. `private.player_scores` : cumul de points par joueur (comptes seulement).
--   2. Trigger `after insert on private.player_results` : attribution au moment
--      exact où le résultat devient définitif. Idempotent par construction :
--      `private.record_match_result` n'insère les lignes `player_results` qu'une
--      seule fois par partie/joueur (frontière d'idempotence `match_results`).
--   3. Backfill idempotent des parties déjà terminées (recalcul complet).
--   4. RPC `public.server_get_leaderboard` : top 100 + rang du joueur courant.
--
-- Barème officiel : win +10, loss +5, draw +7, cooperative (réussite) +10,
-- abandoned 0. Les invités (site_members.is_guest) ne marquent aucun point.

-- ---------------------------------------------------------------------------
-- 1. Cumul de points
-- ---------------------------------------------------------------------------

create table if not exists private.player_scores (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  points integer not null default 0 check (points >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  cooperative integer not null default 0 check (cooperative >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists player_scores_rank_idx
  on private.player_scores (points desc, wins desc, losses asc, updated_at asc, user_id);

revoke all on private.player_scores from public, anon, authenticated;
grant all on private.player_scores to service_role;

-- ---------------------------------------------------------------------------
-- 2. Attribution au moment du résultat définitif
-- ---------------------------------------------------------------------------

create or replace function private.award_player_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_points integer;
begin
  if not private.is_permanent_member(new.user_id) then
    return new;
  end if;

  v_points := case new.outcome
    when 'win' then 10
    when 'loss' then 5
    when 'draw' then 7
    when 'cooperative' then 10
    else 0
  end;

  insert into private.player_scores (
    user_id, points, wins, losses, draws, cooperative, updated_at
  )
  values (
    new.user_id,
    v_points,
    case when new.outcome = 'win' then 1 else 0 end,
    case when new.outcome = 'loss' then 1 else 0 end,
    case when new.outcome = 'draw' then 1 else 0 end,
    case when new.outcome = 'cooperative' then 1 else 0 end,
    clock_timestamp()
  )
  on conflict (user_id) do update set
    points = private.player_scores.points + excluded.points,
    wins = private.player_scores.wins + excluded.wins,
    losses = private.player_scores.losses + excluded.losses,
    draws = private.player_scores.draws + excluded.draws,
    cooperative = private.player_scores.cooperative + excluded.cooperative,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

revoke all on function private.award_player_points() from public, anon, authenticated;

drop trigger if exists player_results_award_points on private.player_results;
create trigger player_results_award_points
after insert on private.player_results
for each row execute function private.award_player_points();

-- ---------------------------------------------------------------------------
-- 3. Recalcul complet (backfill des parties déjà terminées, idempotent)
-- ---------------------------------------------------------------------------

create or replace function private.rebuild_player_scores()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.player_scores as ps
  where not exists (
    select 1 from private.player_results as pr where pr.user_id = ps.user_id
  );

  insert into private.player_scores (
    user_id, points, wins, losses, draws, cooperative, updated_at
  )
  select
    pr.user_id,
    sum(case pr.outcome
      when 'win' then 10
      when 'loss' then 5
      when 'draw' then 7
      when 'cooperative' then 10
      else 0
    end)::integer,
    count(*) filter (where pr.outcome = 'win')::integer,
    count(*) filter (where pr.outcome = 'loss')::integer,
    count(*) filter (where pr.outcome = 'draw')::integer,
    count(*) filter (where pr.outcome = 'cooperative')::integer,
    now()
  from private.player_results as pr
  join public.profiles as p on p.id = pr.user_id
  where private.is_permanent_member(pr.user_id)
  group by pr.user_id
  on conflict (user_id) do update set
    points = excluded.points,
    wins = excluded.wins,
    losses = excluded.losses,
    draws = excluded.draws,
    cooperative = excluded.cooperative,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function private.rebuild_player_scores() from public, anon, authenticated;

select private.rebuild_player_scores();

-- ---------------------------------------------------------------------------
-- 4. Lecture serveur — classement
-- ---------------------------------------------------------------------------

create or replace function public.server_get_leaderboard(
  p_actor uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_limit integer;
  v_entries jsonb;
  v_me jsonb;
begin
  if p_actor is null then raise exception 'INVALID_REQUEST'; end if;
  if not private.is_permanent_member(p_actor) then raise exception 'ACCOUNT_REQUIRED'; end if;

  v_limit := least(greatest(coalesce(p_limit, 100), 1), 100);

  select coalesce(jsonb_agg(entry order by (entry->>'rank')::integer), '[]'::jsonb)
  into v_entries
  from (
    select jsonb_build_object(
      'rank', row_number() over (
        order by ps.points desc, ps.wins desc, ps.losses asc, ps.updated_at asc, ps.user_id
      ),
      'userId', p.id,
      'name', coalesce(p.display_name, p.account_name, p.pseudo),
      'avatarPath', p.avatar_path,
      'avatarPreset', p.avatar_preset,
      'points', ps.points,
      'wins', ps.wins,
      'losses', ps.losses,
      'draws', ps.draws
    ) as entry
    from private.player_scores as ps
    join public.profiles as p on p.id = ps.user_id
    where ps.points > 0
    order by ps.points desc, ps.wins desc, ps.losses asc, ps.updated_at asc, ps.user_id
    limit v_limit
  ) as ranked;

  select jsonb_build_object(
    'rank', ranked.rank,
    'points', ranked.points,
    'wins', ranked.wins,
    'losses', ranked.losses,
    'draws', ranked.draws
  )
  into v_me
  from (
    select
      ps.user_id,
      row_number() over (
        order by ps.points desc, ps.wins desc, ps.losses asc, ps.updated_at asc, ps.user_id
      ) as rank,
      ps.points,
      ps.wins,
      ps.losses,
      ps.draws
    from private.player_scores as ps
    where ps.points > 0
  ) as ranked
  where ranked.user_id = p_actor;

  return jsonb_build_object('entries', v_entries, 'me', v_me);
end;
$$;

revoke all on function public.server_get_leaderboard(uuid, integer) from public, anon, authenticated;
grant execute on function public.server_get_leaderboard(uuid, integer) to service_role;
