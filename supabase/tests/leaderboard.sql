begin;

select plan(31);

-- ---------------------------------------------------------------------------
-- Structure, privilèges et barème
-- ---------------------------------------------------------------------------

select ok(
  exists (select 1 from information_schema.tables where table_schema = 'private' and table_name = 'player_scores'),
  'Leaderboard : la table des points existe'
);

select ok(
  exists (select 1 from pg_indexes where schemaname = 'private' and indexname = 'player_scores_rank_idx'),
  'Leaderboard : l''index de classement existe'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'player_results_award_points'
      and tgrelid = 'private.player_results'::regclass
      and not tgisinternal
  ),
  'Leaderboard : l''attribution est branchée sur le résultat définitif par joueur'
);

select ok(
  (select prosecdef from pg_proc where oid = 'private.award_player_points()'::regprocedure) = true,
  'Leaderboard : award_player_points est SECURITY DEFINER'
);

select ok(
  (select prosecdef from pg_proc where oid = 'private.rebuild_player_scores()'::regprocedure) = true,
  'Leaderboard : le recalcul complet est SECURITY DEFINER'
);

select ok(
  exists (select 1 from pg_proc where oid = 'public.server_get_leaderboard(uuid, integer)'::regprocedure)
    and (select prosecdef from pg_proc where oid = 'public.server_get_leaderboard(uuid, integer)'::regprocedure) = false,
  'Leaderboard : la RPC de lecture existe et reste SECURITY INVOKER'
);

select ok(
  has_function_privilege('service_role', 'public.server_get_leaderboard(uuid, integer)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.server_get_leaderboard(uuid, integer)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.server_get_leaderboard(uuid, integer)', 'EXECUTE'),
  'Leaderboard : la RPC est réservée au rôle serveur'
);

select ok(
  not has_table_privilege('authenticated', 'private.player_scores', 'SELECT')
    and not has_table_privilege('anon', 'private.player_scores', 'SELECT')
    and has_table_privilege('service_role', 'private.player_scores', 'SELECT'),
  'Leaderboard : les points ne sont lisibles que par le rôle serveur'
);

-- ---------------------------------------------------------------------------
-- Identités de test et parties
-- ---------------------------------------------------------------------------

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
)
values
  ('00000000-0000-4000-8000-00000000b101', 'authenticated', 'authenticated', 'leaderboard-alice@example.invalid', clock_timestamp(), '{}'::jsonb, '{}'::jsonb, clock_timestamp(), clock_timestamp(), false, false),
  ('00000000-0000-4000-8000-00000000b102', 'authenticated', 'authenticated', 'leaderboard-bob@example.invalid', clock_timestamp(), '{}'::jsonb, '{}'::jsonb, clock_timestamp(), clock_timestamp(), false, false),
  ('00000000-0000-4000-8000-00000000b103', 'authenticated', 'authenticated', null, clock_timestamp(), '{}'::jsonb, '{}'::jsonb, clock_timestamp(), clock_timestamp(), false, true),
  ('00000000-0000-4000-8000-00000000b104', 'authenticated', 'authenticated', 'leaderboard-dave@example.invalid', clock_timestamp(), '{}'::jsonb, '{}'::jsonb, clock_timestamp(), clock_timestamp(), false, false);

create or replace function pg_temp.lb_seed_match(
  p_match uuid,
  p_code text,
  p_slug text
)
returns void
language plpgsql
as $$
begin
  insert into private.rooms (
    id, code, host_id, game_slug, config, status, version, expires_at
  )
  values (
    p_match,
    p_code,
    '00000000-0000-4000-8000-00000000b101'::uuid,
    p_slug,
    '{}'::jsonb,
    'playing',
    1,
    clock_timestamp() + interval '1 hour'
  );

  insert into private.room_members (room_id, user_id, seat, ready, last_seen_at)
  values
    (p_match, '00000000-0000-4000-8000-00000000b101'::uuid, 0, true, clock_timestamp()),
    (p_match, '00000000-0000-4000-8000-00000000b102'::uuid, 1, true, clock_timestamp());

  insert into private.matches (
    id, room_id, game_slug, status, mode, config, rules_version,
    engine_version, state_schema_version, content_manifest, state, version,
    phase_id, deadline_at, deadline_kind
  )
  values (
    p_match,
    p_match,
    p_slug,
    'active',
    'random',
    '{}'::jsonb,
    p_slug || '-1',
    p_slug || '-engine-1',
    1,
    '{}'::jsonb,
    '{}'::jsonb,
    0,
    gen_random_uuid(),
    clock_timestamp() + interval '1 hour',
    'turn_timeout'
  );

  insert into private.match_players (match_id, user_id, seat, pseudo_snapshot, avatar_snapshot, last_seen_at)
  values
    (p_match, '00000000-0000-4000-8000-00000000b101'::uuid, 0, 'LB Alice', '{}'::jsonb, clock_timestamp()),
    (p_match, '00000000-0000-4000-8000-00000000b102'::uuid, 1, 'LB Bob', '{}'::jsonb, clock_timestamp());
end;
$$;

select pg_temp.lb_seed_match('00000000-0000-4000-8000-00000000c101', 'LBAAAA', 'geographie');
select pg_temp.lb_seed_match('00000000-0000-4000-8000-00000000c102', 'LBAABA', 'geographie');
select pg_temp.lb_seed_match('00000000-0000-4000-8000-00000000c103', 'LBAACA', 'compatibilite');
select pg_temp.lb_seed_match('00000000-0000-4000-8000-00000000c104', 'LBAADA', 'geographie');
select pg_temp.lb_seed_match('00000000-0000-4000-8000-00000000c105', 'LBAAEA', 'geographie');

-- m1 : victoire compétitive d'Alice.
insert into private.match_results (match_id, kind, outcome, winner_id, shared_score, summary, reason)
values ('00000000-0000-4000-8000-00000000c101', 'competitive', 'win', '00000000-0000-4000-8000-00000000b101', null, '{}'::jsonb, 'normal');
insert into private.player_results (match_id, user_id, outcome)
values
  ('00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000b101', 'win'),
  ('00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000b102', 'loss');

-- m2 : match nul.
insert into private.match_results (match_id, kind, outcome, winner_id, shared_score, summary, reason)
values ('00000000-0000-4000-8000-00000000c102', 'competitive', 'draw', null, null, '{}'::jsonb, 'round_limit');
insert into private.player_results (match_id, user_id, outcome)
values
  ('00000000-0000-4000-8000-00000000c102', '00000000-0000-4000-8000-00000000b101', 'draw'),
  ('00000000-0000-4000-8000-00000000c102', '00000000-0000-4000-8000-00000000b102', 'draw');

-- m3 : réussite coopérative.
insert into private.match_results (match_id, kind, outcome, winner_id, shared_score, summary, reason)
values ('00000000-0000-4000-8000-00000000c103', 'cooperative', 'cooperative', null, 80, '{}'::jsonb, 'normal');
insert into private.player_results (match_id, user_id, outcome)
values
  ('00000000-0000-4000-8000-00000000c103', '00000000-0000-4000-8000-00000000b101', 'cooperative'),
  ('00000000-0000-4000-8000-00000000c103', '00000000-0000-4000-8000-00000000b102', 'cooperative');

-- m4 : partie sans vainqueur.
insert into private.match_results (match_id, kind, outcome, winner_id, shared_score, summary, reason)
values ('00000000-0000-4000-8000-00000000c104', 'competitive', 'abandoned', null, null, '{}'::jsonb, 'technical_error');
insert into private.player_results (match_id, user_id, outcome)
values
  ('00000000-0000-4000-8000-00000000c104', '00000000-0000-4000-8000-00000000b101', 'abandoned'),
  ('00000000-0000-4000-8000-00000000c104', '00000000-0000-4000-8000-00000000b102', 'abandoned');

-- m5 : l'invitée Carol gagne contre Alice ; Alice marque quand même.
insert into private.match_results (match_id, kind, outcome, winner_id, shared_score, summary, reason)
values ('00000000-0000-4000-8000-00000000c105', 'competitive', 'win', '00000000-0000-4000-8000-00000000b103', null, '{}'::jsonb, 'normal');
insert into private.player_results (match_id, user_id, outcome)
values
  ('00000000-0000-4000-8000-00000000c105', '00000000-0000-4000-8000-00000000b103', 'win'),
  ('00000000-0000-4000-8000-00000000c105', '00000000-0000-4000-8000-00000000b101', 'loss');

-- ---------------------------------------------------------------------------
-- Barème
-- ---------------------------------------------------------------------------

select is(
  (select points from private.player_scores where user_id = '00000000-0000-4000-8000-00000000b101'),
  32,
  'Leaderboard : 10 (victoire) + 7 (nul) + 10 (coop) + 0 (sans vainqueur) + 5 (défaite) = 32'
);

select is(
  (select wins from private.player_scores where user_id = '00000000-0000-4000-8000-00000000b101'),
  1,
  'Leaderboard : Alice compte une victoire'
);

select is(
  (select losses from private.player_scores where user_id = '00000000-0000-4000-8000-00000000b101'),
  1,
  'Leaderboard : Alice compte une défaite'
);

select is(
  (select draws from private.player_scores where user_id = '00000000-0000-4000-8000-00000000b101'),
  1,
  'Leaderboard : Alice compte un match nul'
);

select is(
  (select cooperative from private.player_scores where user_id = '00000000-0000-4000-8000-00000000b101'),
  1,
  'Leaderboard : Alice compte une réussite coopérative'
);

select is(
  (select points from private.player_scores where user_id = '00000000-0000-4000-8000-00000000b102'),
  22,
  'Leaderboard : 5 (défaite) + 7 (nul) + 10 (coop) = 22 pour Bob'
);

select is(
  (select losses from private.player_scores where user_id = '00000000-0000-4000-8000-00000000b102'),
  1,
  'Leaderboard : Bob compte une défaite'
);

select is(
  (select draws from private.player_scores where user_id = '00000000-0000-4000-8000-00000000b102'),
  1,
  'Leaderboard : Bob compte un match nul'
);

select is(
  (select cooperative from private.player_scores where user_id = '00000000-0000-4000-8000-00000000b102'),
  1,
  'Leaderboard : Bob compte une réussite coopérative'
);

select ok(
  not exists (select 1 from private.player_scores where user_id = '00000000-0000-4000-8000-00000000b103'),
  'Leaderboard : un invité ne marque aucun point'
);

-- Rejeu du même résultat (frontière d'idempotence) : aucun double comptage.
insert into private.player_results (match_id, user_id, outcome)
values
  ('00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000b101', 'win'),
  ('00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000b102', 'loss')
on conflict (match_id, user_id) do nothing;

select is(
  (select points from private.player_scores where user_id = '00000000-0000-4000-8000-00000000b101'),
  32,
  'Leaderboard : un résultat rejoué ne double pas les points'
);

-- ---------------------------------------------------------------------------
-- Recalcul complet (backfill)
-- ---------------------------------------------------------------------------

delete from private.player_scores;
select private.rebuild_player_scores();

select is(
  (select points from private.player_scores where user_id = '00000000-0000-4000-8000-00000000b101'),
  32,
  'Leaderboard : le recalcul complet reproduit les points d''Alice'
);

select is(
  (select points from private.player_scores where user_id = '00000000-0000-4000-8000-00000000b102'),
  22,
  'Leaderboard : le recalcul complet reproduit les points de Bob'
);

select is(
  (select wins from private.player_scores where user_id = '00000000-0000-4000-8000-00000000b101'),
  1,
  'Leaderboard : le recalcul complet reproduit les compteurs'
);

select ok(
  not exists (select 1 from private.player_scores where user_id = '00000000-0000-4000-8000-00000000b103'),
  'Leaderboard : le recalcul complet exclut les invités'
);

-- ---------------------------------------------------------------------------
-- RPC de lecture
-- ---------------------------------------------------------------------------

create temporary table lb_payloads (
  name text primary key,
  payload jsonb not null
) on commit drop;

insert into lb_payloads (name, payload)
values
  ('alice', public.server_get_leaderboard('00000000-0000-4000-8000-00000000b101', 100)),
  ('bob', public.server_get_leaderboard('00000000-0000-4000-8000-00000000b102', 100)),
  ('dave', public.server_get_leaderboard('00000000-0000-4000-8000-00000000b104', 100)),
  ('limited', public.server_get_leaderboard('00000000-0000-4000-8000-00000000b101', 1));

select is(
  jsonb_array_length((select payload->'entries' from lb_payloads where name = 'alice')),
  2,
  'Leaderboard : seuls les comptes avec des points sont classés'
);

select is(
  (select (payload->'entries'->0->>'rank')::int from lb_payloads where name = 'alice'),
  1,
  'Leaderboard : Alice est première'
);

select is(
  (select (payload->'entries'->0->>'points')::int from lb_payloads where name = 'alice'),
  32,
  'Leaderboard : Alice expose ses 32 points'
);

select is(
  (select (payload->'entries'->1->>'points')::int from lb_payloads where name = 'alice'),
  22,
  'Leaderboard : Bob est deuxième avec 22 points'
);

select is(
  (select (payload->'me'->>'rank')::int from lb_payloads where name = 'bob'),
  2,
  'Leaderboard : le joueur courant connaît son rang'
);

select ok(
  (select payload->>'me' is null from lb_payloads where name = 'dave'),
  'Leaderboard : un compte sans point n''a pas de rang'
);

select is(
  jsonb_array_length((select payload->'entries' from lb_payloads where name = 'limited')),
  1,
  'Leaderboard : la limite de lecture est bornée'
);

select throws_ok(
  $$select public.server_get_leaderboard('00000000-0000-4000-8000-00000000b103'::uuid, 100)$$,
  'P0001',
  'ACCOUNT_REQUIRED',
  'Leaderboard : un invité ne peut pas consulter le classement'
);

select * from finish();

rollback;
