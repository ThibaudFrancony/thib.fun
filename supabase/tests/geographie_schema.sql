begin;

select plan(21);

select has_schema('private', 'Le schéma privé existe');
select has_table('public', 'profiles', 'Les profils sont disponibles');
select has_table('public', 'games', 'Le catalogue des jeux est disponible');
select has_table('private', 'content_items', 'Les contenus versionnés sont disponibles');
select has_table('private', 'matches', 'Les parties sont disponibles');
select has_table('public', 'match_views', 'Les projections de partie sont disponibles');
select has_table('private', 'jobs', 'Les tâches durables sont disponibles');

select has_column('private', 'matches', 'state', 'Une partie conserve son état privé');
select has_column('private', 'matches', 'version', 'Une partie conserve sa version');
select has_column('private', 'content_items', 'payload', 'Les items conservent leur payload');

select is(
  (select count(*) from public.games),
  9::bigint,
  'Le catalogue contient les neuf jeux prévus'
);
select is(
  (select count(*) from public.games where slug = 'geographie'),
  1::bigint,
  'Le slug geographie est unique'
);
select is(
  (select availability from public.games where slug = 'geographie'),
  'coming_soon'::text,
  'Géographie reste indisponible tant que le jeu n est pas livré'
);

select is(
  (select relrowsecurity from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'profiles'),
  true,
  'RLS est activé sur profiles'
);
select is(
  (select relrowsecurity from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'games'),
  true,
  'RLS est activé sur games'
);
select is(
  (select relrowsecurity from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'room_views'),
  true,
  'RLS est activé sur room_views'
);
select is(
  (select relrowsecurity from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'match_views'),
  true,
  'RLS est activé sur match_views'
);
select is(
  (select relrowsecurity from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'history_entries'),
  true,
  'RLS est activé sur history_entries'
);
select is(
  (select relrowsecurity from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'player_game_stats'),
  true,
  'RLS est activé sur player_game_stats'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'private'
      and indexname = 'matches_one_active_per_room_idx'
  ),
  'Une seule partie active est autorisée par salon'
);
select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_site_member'
      and p.prosecdef
  ),
  'Le contrôle site_member est une fonction SECURITY DEFINER'
);

select * from finish();
rollback;
