begin;

select plan(14);

-- ---------------------------------------------------------------------------
-- Aperçu de salon (lien partagé)
-- ---------------------------------------------------------------------------

select ok(
  exists (
    select 1 from pg_proc
    where oid = 'public.server_get_room_preview(uuid, uuid)'::regprocedure
  ),
  'Étape 10 : l''aperçu de salon existe'
);

select ok(
  not (select prosecdef from pg_proc where oid = 'public.server_get_room_preview(uuid, uuid)'::regprocedure),
  'Étape 10 : l''aperçu de salon reste SECURITY INVOKER'
);

select ok(
  has_function_privilege('service_role', 'public.server_get_room_preview(uuid, uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.server_get_room_preview(uuid, uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.server_get_room_preview(uuid, uuid)', 'EXECUTE'),
  'Étape 10 : seul le serveur peut lire l''aperçu'
);

select ok(
  position('''pseudo''' in lower(pg_get_functiondef('public.server_get_room_preview(uuid, uuid)'::regprocedure))) = 0
    and position('''members''' in lower(pg_get_functiondef('public.server_get_room_preview(uuid, uuid)'::regprocedure))) = 0
    and position('''memberCount''' in pg_get_functiondef('public.server_get_room_preview(uuid, uuid)'::regprocedure)) > 0,
  'Étape 10 : l''aperçu n''expose ni pseudo ni liste de membres'
);

-- ---------------------------------------------------------------------------
-- Sortie d'un salon fermé
-- ---------------------------------------------------------------------------

select ok(
  position('v_room.status = ''playing''' in pg_get_functiondef('public.server_change_room(uuid, uuid, uuid, bigint, jsonb)'::regprocedure)) > 0
    and position('v_expired or v_room.status = ''closed''' in pg_get_functiondef('public.server_change_room(uuid, uuid, uuid, bigint, jsonb)'::regprocedure)) > 0,
  'Étape 10 : LEAVE est possible sur un salon fermé sans rouvrir la salle'
);

-- ---------------------------------------------------------------------------
-- Démarrage : reçu vérifié et clôture des parties précédentes
-- ---------------------------------------------------------------------------

select ok(
  position('v_receipt_actor is distinct from p_actor' in pg_get_functiondef('public.server_start_match(uuid, uuid, uuid, bigint, uuid, text, jsonb, jsonb, uuid, timestamptz, text, jsonb, jsonb, jsonb, text, text, integer)'::regprocedure)) > 0
    and position('''START_MATCH''' in pg_get_functiondef('public.server_start_match(uuid, uuid, uuid, bigint, uuid, text, jsonb, jsonb, uuid, timestamptz, text, jsonb, jsonb, jsonb, text, text, integer)'::regprocedure)) > 0
    and position('''COMMAND_ID_REUSED''' in pg_get_functiondef('public.server_start_match(uuid, uuid, uuid, bigint, uuid, text, jsonb, jsonb, uuid, timestamptz, text, jsonb, jsonb, jsonb, text, text, integer)'::regprocedure)) > 0,
  'Étape 10 : le reçu START vérifie acteur, type et payload'
);

select ok(
  position('private.finalize_match_abandoned' in pg_get_functiondef('public.server_start_match(uuid, uuid, uuid, bigint, uuid, text, jsonb, jsonb, uuid, timestamptz, text, jsonb, jsonb, jsonb, text, text, integer)'::regprocedure)) > 0
    and position('''superseded''' in pg_get_functiondef('public.server_start_match(uuid, uuid, uuid, bigint, uuid, text, jsonb, jsonb, uuid, timestamptz, text, jsonb, jsonb, jsonb, text, text, integer)'::regprocedure)) > 0,
  'Étape 10 : un nouveau départ clôt explicitement les parties actives précédentes'
);

select ok(
  has_function_privilege('service_role', 'public.server_start_match(uuid, uuid, uuid, bigint, uuid, text, jsonb, jsonb, uuid, timestamptz, text, jsonb, jsonb, jsonb, text, text, integer)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.server_start_match(uuid, uuid, uuid, bigint, uuid, text, jsonb, jsonb, uuid, timestamptz, text, jsonb, jsonb, jsonb, text, text, integer)', 'EXECUTE'),
  'Étape 10 : START reste réservé au rôle serveur'
);

-- ---------------------------------------------------------------------------
-- Worker : jobs de service et reprise des baux épuisés
-- ---------------------------------------------------------------------------

select ok(
  position('''release_ai_reservation''' in pg_get_functiondef('public.server_fail_job(uuid, uuid, text)'::regprocedure)) > 0
    and position('not v_service_job' in lower(pg_get_functiondef('public.server_fail_job(uuid, uuid, text)'::regprocedure))) > 0,
  'Étape 10 : un job de service échoué n''interrompt pas la partie'
);

select ok(
  exists (
    select 1 from pg_proc
    where oid = 'private.reap_exhausted_jobs()'::regprocedure
  )
    and position('attempts >= 5' in pg_get_functiondef('private.reap_exhausted_jobs()'::regprocedure)) > 0
    and position('''worker_unreachable''' in pg_get_functiondef('private.reap_exhausted_jobs()'::regprocedure)) > 0,
  'Étape 10 : les baux épuisés orphelins sont clôturés sans perdre la partie'
);

select ok(
  exists (
    select 1 from cron.job
    where jobname = 'tibo-fun-reap-exhausted-jobs' and active
  ),
  'Étape 10 : le cron de reprise des baux est actif'
);

select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'match_results_reason_check') like '%superseded%'
    and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'match_results_reason_check') like '%worker_unreachable%',
  'Étape 10 : les nouvelles raisons de clôture sont autorisées en base'
);

select ok(
  position('''MATCH_ABANDONED''' in pg_get_functiondef('private.finalize_match_abandoned(uuid, private.matches, uuid, text, timestamptz)'::regprocedure)) > 0
    and position('private.finalize_match_abandoned' in pg_get_functiondef('private.finalize_match_technical_error(uuid, private.matches, uuid, text, timestamptz)'::regprocedure)) > 0,
  'Étape 10 : la clôture générique est partagée et tracée par un événement'
);

select ok(
  position('''superseded''' in pg_get_functiondef('private.record_match_result(uuid, private.matches, jsonb, timestamptz)'::regprocedure)) > 0
    and position('''worker_unreachable''' in pg_get_functiondef('private.record_match_result(uuid, private.matches, jsonb, timestamptz)'::regprocedure)) > 0,
  'Étape 10 : la finalisation commune accepte les nouvelles raisons'
);

select * from finish();
rollback;
