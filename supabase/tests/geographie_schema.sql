begin;

select plan(40);

select has_schema('private', 'Le schéma privé existe');
select has_table('public', 'profiles', 'Les profils sont disponibles');
select has_table('public', 'games', 'Le catalogue des jeux est disponible');
select has_table('private', 'content_items', 'Les contenus versionnés sont disponibles');
select has_table('private', 'content_packs', 'Le pack de contenu est disponible');
select has_table('private', 'matches', 'Les parties sont disponibles');
select has_table('public', 'match_views', 'Les projections de partie sont disponibles');
select has_table('private', 'jobs', 'Les tâches durables sont disponibles');
select has_table('private', 'job_receipts', 'Les reçus de tâches système sont disponibles');

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
  'ready'::text,
  'Géographie est disponible après livraison du moteur et du pack'
);
select is((select count(*) from public.games where slug = 'uno'), 1::bigint, 'Le slug uno est disponible dans le catalogue');
select is((select availability from public.games where slug = 'uno'), 'ready'::text, 'UNO est disponible après livraison du moteur');
select is((select count(*) from private.content_items), 380::bigint, 'Le pack contient 380 communes');
select is((select count(*) from private.content_items where category = 'easy'), 40::bigint, 'Le pool facile contient 40 communes');
select is((select count(*) from private.content_items where category = 'medium'), 120::bigint, 'Le pool moyen contient 120 communes');
select is((select count(*) from private.content_items where category = 'hard'), 220::bigint, 'Le pool difficile contient 220 communes');

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
    from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'user_broadcast_receive'
  ),
  'Les broadcasts sont lisibles seulement sur le canal utilisateur'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'match_views_broadcast_update'
  ),
  'Les mises à jour de partie émettent une invalidation'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'history_entries_broadcast_update'
  ),
  'Les résultats émettent une invalidation historique'
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
select ok(exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'server_start_match'), 'La RPC de démarrage existe');
select ok(exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'server_commit_match'), 'La RPC de commit atomique existe');
select ok(exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'claim_due_jobs'), 'Le claim des tâches échues existe');
select ok(exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'dispatch_due_jobs'), 'Le dispatcher durable existe');
select ok(exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'server_get_job_context'), 'Le contexte privé du worker existe');
select ok(exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'server_finish_job'), 'La clôture idempotente des tâches existe');

select ok(exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname = 'public' and p.proname = 'server_room_heartbeat'), 'Le heartbeat du salon existe');
select ok(exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname = 'public' and p.proname = 'server_get_pair_history'), 'La lecture du duo est restreinte à une RPC serveur');

select * from finish();
rollback;
