begin;

select plan(23);

select ok(
  exists (select 1 from pg_proc where oid = 'private.merge_game_metrics(text, jsonb, jsonb)'::regprocedure),
  'Étape 5 : le fusionneur de métriques est installé'
);
select ok(
  exists (select 1 from pg_proc where oid = 'private.rebuild_player_game_metrics(uuid, text)'::regprocedure)
    and exists (select 1 from pg_proc where oid = 'private.rebuild_pair_game_metrics(uuid, uuid, text)'::regprocedure),
  'Étape 5 : le recalcul depuis les résultats conservés est disponible'
);
select ok(
  exists (select 1 from pg_proc where oid = 'private.rebuild_player_game_stats(uuid, text)'::regprocedure)
    and exists (select 1 from pg_proc where oid = 'private.rebuild_pair_game_stats(uuid, uuid, text)'::regprocedure),
  'Étape 5 : le recalcul des compteurs est disponible'
);

select is(
  (private.merge_game_metrics(
    'ttmc',
    '{"correct":2,"chosenLevelSum":4,"answeredCount":1,"correctByLevel":{"2":1},"attemptsByLevel":{"2":1}}'::jsonb,
    '{"correct":3,"chosenLevelSum":6,"answeredCount":2,"averageLevel":99,"correctByLevel":{"2":2,"4":1},"attemptsByLevel":{"2":2,"4":1}}'::jsonb
  )->>'correct')::integer,
  5,
  'Métriques : les compteurs simples sont additionnés'
);
select is(
  (private.merge_game_metrics(
    'ttmc',
    '{"correct":2,"chosenLevelSum":4,"answeredCount":1,"correctByLevel":{"2":1},"attemptsByLevel":{"2":1}}'::jsonb,
    '{"correct":3,"chosenLevelSum":6,"answeredCount":2,"averageLevel":99,"correctByLevel":{"2":2,"4":1},"attemptsByLevel":{"2":2,"4":1}}'::jsonb
  )->'correctByLevel'->>'2')::integer,
  3,
  'Métriques : les compteurs par niveau sont additionnés'
);
select is(
  (private.merge_game_metrics(
    'ttmc',
    '{"chosenLevelSum":4,"answeredCount":1}'::jsonb,
    '{"chosenLevelSum":6,"answeredCount":2,"averageLevel":99}'::jsonb
  )->>'averageLevel')::numeric,
  (10::numeric / 3::numeric),
  'Métriques : la moyenne est recalculée depuis son dénominateur'
);
select is(
  (private.merge_game_metrics(
    'geographie',
    '{"distanceSumKm":10,"validPlacements":1,"bestDistanceKm":10}'::jsonb,
    '{"distanceSumKm":5,"validPlacements":1,"bestDistanceKm":4}'::jsonb
  )->>'distanceSumKm')::numeric,
  15::numeric,
  'Métriques : les distances cumulées sont additionnées'
);
select is(
  (private.merge_game_metrics(
    'geographie',
    '{"bestDistanceKm":10}'::jsonb,
    '{"bestDistanceKm":4}'::jsonb
  )->>'bestDistanceKm')::numeric,
  4::numeric,
  'Métriques : la meilleure distance conserve le minimum'
);
select is(
  (private.merge_game_metrics(
    'bombparty',
    '{"responseTotalMs":1000,"responseCount":2,"longestWordLength":6}'::jsonb,
    '{"responseTotalMs":500,"responseCount":1,"longestWordLength":9,"meanAcceptedResponseMs":1}'::jsonb
  )->>'meanAcceptedResponseMs')::numeric,
  500::numeric,
  'Métriques : la moyenne de réponse est pondérée'
);
select is(
  (private.merge_game_metrics(
    'bombparty',
    '{"longestWordLength":6}'::jsonb,
    '{"longestWordLength":9}'::jsonb
  )->>'longestWordLength')::integer,
  9,
  'Métriques : la longueur maximale conserve le maximum'
);
select is(
  (private.merge_game_metrics(
    'bataille-navale',
    '{"shots":3,"hits":1}'::jsonb,
    '{"shots":2,"hits":2}'::jsonb
  )->>'precision')::numeric,
  (3::numeric / 5::numeric),
  'Métriques : la précision est recalculée depuis les tirs'
);
select is(
  (private.merge_game_metrics(
    'compatibilite',
    '{"matches":1,"compared":2,"sharedScore":50}'::jsonb,
    '{"matches":2,"compared":3,"sharedScore":99}'::jsonb
  )->>'sharedScore')::integer,
  60,
  'Métriques : le score commun est recalculé depuis matches/compared'
);
select is(
  (private.merge_game_metrics(
    'longueur-onde',
    '{"total":4,"maxTotal":8,"guessErrorSum":10,"guessCount":2}'::jsonb,
    '{"total":5,"maxTotal":8,"guessErrorSum":5,"guessCount":1,"percentage":1,"averageError":1}'::jsonb
  )->>'percentage')::integer,
  56,
  'Métriques : le pourcentage coopératif est recalculé'
);
select is(
  (private.merge_game_metrics(
    'longueur-onde',
    '{"guessErrorSum":10,"guessCount":2}'::jsonb,
    '{"guessErrorSum":5,"guessCount":1,"averageError":1}'::jsonb
  )->>'averageError')::integer,
  5,
  'Métriques : l''écart moyen est recalculé depuis son dénominateur'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'refresh_player_game_stats_metrics'
      and tgrelid = 'public.player_game_stats'::regclass
  ),
  'Métriques : les statistiques joueur sont recalculées avant écriture'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'refresh_pair_game_stats_metrics'
      and tgrelid = 'private.pair_game_stats'::regclass
  ),
  'Métriques : les statistiques de duo sont recalculées avant écriture'
);
select ok(
  not exists (
    select 1 from pg_trigger
    where tgname in ('normalize_compat_player_stats', 'normalize_longueur_onde_player_stats')
      and tgrelid = 'public.player_game_stats'::regclass
  ),
  'Métriques : les anciens normaliseurs unitaires ne remplacent plus les cumuls'
);

select ok(
  position('v_game_slug text' in lower(pg_get_functiondef('private.normalize_compat_player_result()'::regprocedure))) > 0
    and position('where m.id = new.match_id' in lower(pg_get_functiondef('private.normalize_compat_player_result()'::regprocedure))) > 0,
  'Compatibilité : le trigger utilise une variable préfixée et la jointure par match'
);
select ok(
  position('v_game_slug text' in lower(pg_get_functiondef('private.record_compat_pair_stats()'::regprocedure))) > 0
    and position('on conflict (player_low, player_high, game_slug)' in lower(pg_get_functiondef('private.record_compat_pair_stats()'::regprocedure))) > 0,
  'Compatibilité : la contrainte de duo est ciblée sans collision de variable'
);
select ok(
  position('v_game_slug text' in lower(pg_get_functiondef('private.normalize_longueur_onde_player_result()'::regprocedure))) > 0
    and position('where m.id = new.match_id' in lower(pg_get_functiondef('private.normalize_longueur_onde_player_result()'::regprocedure))) > 0,
  'Longueur d''onde : la jointure player_result cible m.id'
);
select ok(
  position('v_game_slug text' in lower(pg_get_functiondef('private.record_longueur_onde_pair_stats()'::regprocedure))) > 0
    and position('on conflict (player_low, player_high, game_slug)' in lower(pg_get_functiondef('private.record_longueur_onde_pair_stats()'::regprocedure))) > 0,
  'Longueur d''onde : la contrainte de duo est ciblée sans collision de variable'
);

select ok(
  has_function_privilege('service_role', 'private.rebuild_player_game_stats(uuid, text)', 'EXECUTE')
    and has_function_privilege('service_role', 'private.rebuild_pair_game_stats(uuid, uuid, text)', 'EXECUTE'),
  'Sécurité : seuls les traitements serveur peuvent demander un recalcul'
);
select ok(
  not has_function_privilege('authenticated', 'private.rebuild_player_game_stats(uuid, text)', 'EXECUTE')
    and not has_function_privilege('anon', 'private.rebuild_pair_game_stats(uuid, uuid, text)', 'EXECUTE'),
  'Sécurité : les rôles client ne peuvent pas demander un recalcul'
);

select * from finish();
rollback;
