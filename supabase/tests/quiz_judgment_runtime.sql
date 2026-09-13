begin;

select plan(40);

select has_table('private', 'quiz_attempts', 'Les tentatives quiz persistantes existent');
select has_table('private', 'judgment_cache', 'Le cache de jugement privé existe');
select has_table('private', 'ai_usage_daily', 'Le compteur journalier IA existe');
select has_table('private', 'ai_calls', 'Les appels IA persistants existent');
select has_table('private', 'ai_job_budgets', 'Le budget par job existe');
select ok(to_regprocedure('public.server_prepare_quiz_judgment(uuid,uuid,uuid,text,text,text,text)') is not null, 'La préparation de jugement existe');
select ok(to_regprocedure('public.server_reserve_ai_usage(uuid,uuid,uuid,text,text,numeric,numeric,integer)') is not null, 'La réservation IA existe');
select ok(to_regprocedure('public.server_settle_ai_usage(uuid,uuid,uuid,smallint,text,text,text,jsonb,integer,integer,numeric,text,text,text)') is not null, 'La finalisation IA existe');
select ok(to_regprocedure('public.server_release_ai_reservation(uuid,uuid,uuid,smallint)') is not null, 'La libération d''une réservation IA existe');
select ok(exists (select 1 from pg_trigger where tgname = 'jobs_create_ai_budget'), 'Le budget est créé par trigger à l''insertion du job');
select ok(exists (select 1 from pg_trigger where tgname = 'match_events_sync_quiz_attempt'), 'Les événements synchronisent les tentatives');
select ok(
  exists (select 1 from pg_trigger where tgname = 'ai_calls_schedule_reservation_release')
  and exists (select 1 from pg_trigger where tgname = 'jobs_release_cancelled_ai_reservation'),
  'Les réservations expirées sont reliées à un job et libérées si ce job est annulé'
);

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
)
values
  (
    '00000000-0000-4000-8000-0000000040a1', 'authenticated', 'authenticated',
    'step4-alice@example.invalid', clock_timestamp(), '{}'::jsonb, '{}'::jsonb,
    clock_timestamp(), clock_timestamp(), false, false
  ),
  (
    '00000000-0000-4000-8000-0000000040a2', 'authenticated', 'authenticated',
    'step4-bob@example.invalid', clock_timestamp(), '{}'::jsonb, '{}'::jsonb,
    clock_timestamp(), clock_timestamp(), false, false
  );

insert into private.content_packs (id, kind, slug, version, status, manifest)
values (
  '00000000-0000-4000-8000-0000000041a1'::uuid,
  'quiz', 'step4-runtime', 1, 'draft', '{}'::jsonb
);
insert into private.content_items (id, pack_id, logical_key, payload)
values (
  '00000000-0000-4000-8000-0000000041b1'::uuid,
  '00000000-0000-4000-8000-0000000041a1'::uuid,
  'step4-question',
  '{"prompt":"Question de test","answer":{"canonical":"Réponse"}}'::jsonb
);

insert into private.rooms (
  id, code, host_id, game_slug, config, status, version, expires_at
)
values (
  '00000000-0000-4000-8000-0000000040b1'::uuid,
  'Q4A2BC', '00000000-0000-4000-8000-0000000040a1'::uuid,
  'ttmc', '{}'::jsonb, 'playing', 1, clock_timestamp() + interval '1 hour'
);
insert into private.room_members (room_id, user_id, seat, ready)
values
  ('00000000-0000-4000-8000-0000000040b1'::uuid, '00000000-0000-4000-8000-0000000040a1'::uuid, 0, true),
  ('00000000-0000-4000-8000-0000000040b1'::uuid, '00000000-0000-4000-8000-0000000040a2'::uuid, 1, true);
insert into private.matches (
  id, room_id, game_slug, status, mode, config, rules_version, engine_version,
  state_schema_version, content_manifest, state, version, phase_id, deadline_at, deadline_kind
)
values (
  '00000000-0000-4000-8000-0000000040c1'::uuid,
  '00000000-0000-4000-8000-0000000040b1'::uuid,
  'ttmc', 'active', 'random', '{}'::jsonb, 'ttmc-v1', 'ttmc-engine-v1', 1,
  '{}'::jsonb,
  jsonb_build_object(
    'phase', 'judging',
    'currentAttempt', jsonb_build_object(
      'id', '00000000-0000-4000-8000-0000000040d1'::uuid,
      'seat', 0,
      'questionItemId', '00000000-0000-4000-8000-0000000041b1'::uuid,
      'rawAnswer', 'une réponse sémantique',
      'normalizedAnswer', 'une reponse semantique',
      'submittedAt', '2026-09-14T10:00:00.000Z',
      'timeout', false
    )
  ),
  0,
  '00000000-0000-4000-8000-0000000040d1'::uuid,
  null, null
);
insert into private.match_players (match_id, user_id, seat, pseudo_snapshot, avatar_snapshot)
values
  ('00000000-0000-4000-8000-0000000040c1'::uuid, '00000000-0000-4000-8000-0000000040a1'::uuid, 0, 'Étape 4 Alice', '{}'::jsonb),
  ('00000000-0000-4000-8000-0000000040c1'::uuid, '00000000-0000-4000-8000-0000000040a2'::uuid, 1, 'Étape 4 Bob', '{}'::jsonb);

insert into private.match_events (match_id, version, event_type, actor_id, payload)
values (
  '00000000-0000-4000-8000-0000000040c1'::uuid,
  1,
  'ANSWER_SUBMITTED',
  '00000000-0000-4000-8000-0000000040a1'::uuid,
  jsonb_build_object(
    'attemptId', '00000000-0000-4000-8000-0000000040d1'::uuid,
    'phaseId', '00000000-0000-4000-8000-0000000040d1'::uuid,
    'seat', 0
  )
);
select ok(
  (select status = 'pending'
   and player_id = '00000000-0000-4000-8000-0000000040a1'::uuid
   and phase_id = '00000000-0000-4000-8000-0000000040d1'::uuid
   and question_revision_id = '00000000-0000-4000-8000-0000000041b1'::uuid
   from private.quiz_attempts
   where id = '00000000-0000-4000-8000-0000000040d1'::uuid),
  'ANSWER_SUBMITTED rattache la tentative au joueur, à la question et à la phase'
);

insert into private.jobs (
  id, match_id, kind, phase_id, dedupe_key, payload, run_at, status,
  attempts, lease_token, lease_until
)
values (
  '00000000-0000-4000-8000-0000000040e1'::uuid,
  '00000000-0000-4000-8000-0000000040c1'::uuid,
  'judge_answer', '00000000-0000-4000-8000-0000000040d1'::uuid,
  'step4:judge',
  jsonb_build_object(
    'matchId', '00000000-0000-4000-8000-0000000040c1'::uuid,
    'attemptId', '00000000-0000-4000-8000-0000000040d1'::uuid,
    'phaseId', '00000000-0000-4000-8000-0000000040d1'::uuid,
    'expectedPhaseId', '00000000-0000-4000-8000-0000000040d1'::uuid
  ),
  clock_timestamp(), 'running', 1,
  '00000000-0000-4000-8000-0000000040f1'::uuid,
  clock_timestamp() + interval '30 seconds'
);
select ok(
  (select match_id = '00000000-0000-4000-8000-0000000040c1'::uuid
    and max_attempts = 2 and attempts_reserved = 0
   from private.ai_job_budgets
   where job_id = '00000000-0000-4000-8000-0000000040e1'::uuid),
  'L''insertion d''un job crée un budget persistant par partie'
);

select is(
  (public.server_get_job_context(
    '00000000-0000-4000-8000-0000000040e1'::uuid,
    '00000000-0000-4000-8000-0000000040f1'::uuid
  )->'jobPayload'->>'attemptId'),
  '00000000-0000-4000-8000-0000000040d1',
  'Le contexte relu par le bail contient le payload privé complet'
);
select is(
  (select deadline_at from private.matches where id = '00000000-0000-4000-8000-0000000040c1'::uuid),
  null::timestamptz,
  'La phase judging ne porte pas de deadline_at joueur'
);
select is(
  (public.server_prepare_quiz_judgment(
    '00000000-0000-4000-8000-0000000040e1'::uuid,
    '00000000-0000-4000-8000-0000000040f1'::uuid,
    '00000000-0000-4000-8000-0000000040d1'::uuid,
    repeat('a', 64), 'fixture-model', 'quiz-judge-v1', 'quiz-judge-v1'
  )->>'status'),
  'ready',
  'Un jugement valide est préparé sans deadline_at'
);
select is(
  (public.server_reserve_ai_usage(
    '00000000-0000-4000-8000-0000000040e1'::uuid,
    '00000000-0000-4000-8000-0000000040f1'::uuid,
    '00000000-0000-4000-8000-0000000040d1'::uuid,
    'deepseek', 'fixture-model', 0.1, 0.3, 10
  )->>'callNo'),
  '1',
  'La première tentative IA réserve atomiquement le slot 1'
);
select is(
  (public.server_reserve_ai_usage(
    '00000000-0000-4000-8000-0000000040e1'::uuid,
    '00000000-0000-4000-8000-0000000040f1'::uuid,
    '00000000-0000-4000-8000-0000000040d1'::uuid,
    'deepseek', 'fixture-model', 0.1, 0.3, 10
  )->>'callNo'),
  '2',
  'La seconde tentative IA réserve atomiquement le slot 2'
);
select is(
  (public.server_reserve_ai_usage(
    '00000000-0000-4000-8000-0000000040e1'::uuid,
    '00000000-0000-4000-8000-0000000040f1'::uuid,
    '00000000-0000-4000-8000-0000000040d1'::uuid,
    'deepseek', 'fixture-model', 0.1, 0.3, 10
  )->>'status'),
  'attempt_limit',
  'Une troisième tentative est refusée par le plafond persistant'
);
select is((select attempts_reserved from private.ai_job_budgets where job_id = '00000000-0000-4000-8000-0000000040e1'::uuid), 2::smallint, 'Le compteur de tentatives reste à deux');
select is((select count(*) from private.ai_calls where attempt_id = '00000000-0000-4000-8000-0000000040d1'::uuid), 2::bigint, 'Deux réservations produisent deux appels distincts');
select is((select count(*) from private.jobs where kind = 'release_ai_reservation' and payload->>'attemptId' = '00000000-0000-4000-8000-0000000040d1'), 2::bigint, 'Chaque réservation crée un job de libération idempotent');
select ok((select calls = 2 and reserved_cost_usd = 0.2 and price_revision = 'configured' from private.ai_usage_daily where provider = 'deepseek' and model_id = 'fixture-model'), 'Le budget journalier cumule les réservations sous verrou');

select is(
  (public.server_settle_ai_usage(
    '00000000-0000-4000-8000-0000000040e1'::uuid,
    '00000000-0000-4000-8000-0000000040f1'::uuid,
    '00000000-0000-4000-8000-0000000040d1'::uuid,
    1::smallint, 'deepseek', 'fixture-model', 'completed',
    '{"verdict":"accept","reasonCode":"equivalent_identity"}'::jsonb,
    10, 4, 0.08, repeat('a', 64), 'quiz-judge-v1', 'quiz-judge-v1'
  )->>'status'),
  'completed',
  'Le résultat DeepSeek simulé est finalisé et comptabilisé'
);
select ok((select status = 'completed' and input_tokens = 10 and output_tokens = 4 from private.ai_calls where attempt_id = '00000000-0000-4000-8000-0000000040d1'::uuid and call_no = 1), 'Les tokens du fournisseur sont conservés');
select ok((select reserved_cost_usd = 0.1 and estimated_cost_usd = 0.08 and input_tokens = 10 and output_tokens = 4 from private.ai_usage_daily where provider = 'deepseek' and model_id = 'fixture-model'), 'Le coût réservé est réconcilié avec le coût observé');
select is(
  (public.server_prepare_quiz_judgment(
    '00000000-0000-4000-8000-0000000040e1'::uuid,
    '00000000-0000-4000-8000-0000000040f1'::uuid,
    '00000000-0000-4000-8000-0000000040d1'::uuid,
    repeat('a', 64), 'fixture-model', 'quiz-judge-v1', 'quiz-judge-v1'
  )->>'status'),
  'cache_hit',
  'Un verdict accept/reject finalisé est réutilisable par le cache privé'
);
select is((select hit_count from private.judgment_cache where cache_key = repeat('a', 64)), 1::bigint, 'Le cache compte le hit sans ajouter d''alias');
select is(
  (public.server_settle_ai_usage(
    '00000000-0000-4000-8000-0000000040e1'::uuid,
    '00000000-0000-4000-8000-0000000040f1'::uuid,
    '00000000-0000-4000-8000-0000000040d1'::uuid,
    1::smallint, 'deepseek', 'fixture-model', 'completed',
    '{"verdict":"accept","reasonCode":"equivalent_identity"}'::jsonb,
    10, 4, 0.08, repeat('a', 64), 'quiz-judge-v1', 'quiz-judge-v1'
  )->>'status'),
  'completed',
  'Le settle répété du même appel est idempotent'
);
select is((select count(*) from private.ai_calls where attempt_id = '00000000-0000-4000-8000-0000000040d1'::uuid), 2::bigint, 'Le settle répété ne crée pas de troisième appel');

update private.jobs
set status = 'running',
    attempts = attempts + 1,
    lease_token = '00000000-0000-4000-8000-0000000040f2'::uuid,
    lease_until = clock_timestamp() + interval '30 seconds'
where kind = 'release_ai_reservation'
  and payload->>'attemptId' = '00000000-0000-4000-8000-0000000040d1'
  and payload->>'callNo' = '2';
select is(
  (public.server_release_ai_reservation(
    (select id from private.jobs where kind = 'release_ai_reservation' and payload->>'attemptId' = '00000000-0000-4000-8000-0000000040d1' and payload->>'callNo' = '2'),
    '00000000-0000-4000-8000-0000000040f2'::uuid,
    '00000000-0000-4000-8000-0000000040d1'::uuid,
    2::smallint
  )->>'status'),
  'released',
  'Une réservation expirée est libérée par son job sans coût nul optimiste'
);
select ok((select status = 'unknown' and actual_cost_usd = 0.1 and settled_at is not null from private.ai_calls where attempt_id = '00000000-0000-4000-8000-0000000040d1'::uuid and call_no = 2), 'Un appel dont le résultat est inconnu conserve son coût maximal');
select ok((select reserved_cost_usd = 0 and estimated_cost_usd = 0.18 from private.ai_usage_daily where provider = 'deepseek' and model_id = 'fixture-model'), 'La libération réconcilie la réserve et le coût estimé');
select ok((select status = 'done' and lease_token is null and lease_until is null from private.jobs where kind = 'release_ai_reservation' and payload->>'attemptId' = '00000000-0000-4000-8000-0000000040d1' and payload->>'callNo' = '2'), 'Le job de libération est clôturé avec son bail effacé');

select throws_ok(
  $q$select public.server_prepare_quiz_judgment(
    '00000000-0000-4000-8000-0000000040e1'::uuid,
    '00000000-0000-4000-8000-0000000040ff'::uuid,
    '00000000-0000-4000-8000-0000000040d1'::uuid,
    repeat('b', 64), 'fixture-model', 'quiz-judge-v1', 'quiz-judge-v1'
  )$q$,
  'P0001', 'JOB_LEASE_INVALID', 'Un bail répété ou invalide est refusé avant toute mutation'
);
select ok((select status = 'running' and attempts = 1 and lease_token = '00000000-0000-4000-8000-0000000040f1'::uuid from private.jobs where id = '00000000-0000-4000-8000-0000000040e1'::uuid), 'Le refus de bail conserve l''état du job');

insert into private.match_events (match_id, version, event_type, actor_id, payload)
values (
  '00000000-0000-4000-8000-0000000040c1'::uuid, 2, 'JUDGMENT_RECEIVED', null,
  jsonb_build_object(
    'attemptId', '00000000-0000-4000-8000-0000000040d1'::uuid,
    'phaseId', '00000000-0000-4000-8000-0000000040d1'::uuid,
    'verdict', 'accept', 'method', 'llm', 'reasonCode', 'equivalent_identity',
    'modelId', 'fixture-model', 'promptVersion', 'quiz-judge-v1', 'latencyMs', 123
  )
);
select ok((select status = 'accepted' and method = 'llm' and reason_code = 'equivalent_identity' and model_id = 'fixture-model' and latency_ms = 123 from private.quiz_attempts where id = '00000000-0000-4000-8000-0000000040d1'::uuid), 'Le jugement met à jour la bonne tentative et la bonne phase');

insert into private.match_events (match_id, version, event_type, actor_id, payload)
values (
  '00000000-0000-4000-8000-0000000040c1'::uuid, 3, 'QUESTION_REPLACED', null,
  jsonb_build_object('attemptId', '00000000-0000-4000-8000-0000000040d1'::uuid, 'phaseId', '00000000-0000-4000-8000-0000000040d1'::uuid, 'reasonCode', 'slow_correction')
);
select is((select status from private.quiz_attempts where id = '00000000-0000-4000-8000-0000000040d1'::uuid), 'void', 'Un remplacement technique void la tentative sans la transformer en mauvaise réponse');

insert into private.rooms (id, code, host_id, game_slug, config, status, version, expires_at)
values ('00000000-0000-4000-8000-0000000041c1'::uuid, 'Q4A2BD', '00000000-0000-4000-8000-0000000040a1'::uuid, 'ttmc', '{}'::jsonb, 'playing', 1, clock_timestamp() + interval '1 hour');
insert into private.room_members (room_id, user_id, seat, ready)
values
  ('00000000-0000-4000-8000-0000000041c1'::uuid, '00000000-0000-4000-8000-0000000040a1'::uuid, 0, true),
  ('00000000-0000-4000-8000-0000000041c1'::uuid, '00000000-0000-4000-8000-0000000040a2'::uuid, 1, true);
insert into private.matches (
  id, room_id, game_slug, status, mode, config, rules_version, engine_version,
  state_schema_version, content_manifest, state, version, phase_id, deadline_at, deadline_kind
)
values (
  '00000000-0000-4000-8000-0000000041d1'::uuid,
  '00000000-0000-4000-8000-0000000041c1'::uuid,
  'ttmc', 'active', 'random', '{}'::jsonb, 'ttmc-v1', 'ttmc-engine-v1', 1,
  '{}'::jsonb,
  jsonb_build_object('phase', 'answering', 'currentAttempt', jsonb_build_object(
    'id', '00000000-0000-4000-8000-0000000041e1'::uuid,
    'seat', 0,
    'questionItemId', '00000000-0000-4000-8000-0000000041b1'::uuid,
    'rawAnswer', '', 'normalizedAnswer', '',
    'submittedAt', '2026-09-14T10:01:00.000Z', 'timeout', true
  )),
  0, '00000000-0000-4000-8000-0000000041e1'::uuid, null, null
);
insert into private.match_players (match_id, user_id, seat, pseudo_snapshot, avatar_snapshot)
values
  ('00000000-0000-4000-8000-0000000041d1'::uuid, '00000000-0000-4000-8000-0000000040a1'::uuid, 0, 'Étape 4 Alice', '{}'::jsonb),
  ('00000000-0000-4000-8000-0000000041d1'::uuid, '00000000-0000-4000-8000-0000000040a2'::uuid, 1, 'Étape 4 Bob', '{}'::jsonb);
insert into private.match_events (match_id, version, event_type, actor_id, payload)
values (
  '00000000-0000-4000-8000-0000000041d1'::uuid, 1, 'ANSWER_TIMED_OUT', null,
  jsonb_build_object('attemptId', '00000000-0000-4000-8000-0000000041e1'::uuid, 'phaseId', '00000000-0000-4000-8000-0000000041e1'::uuid)
);
select ok((select status = 'rejected' and method = 'timeout' and phase_id = '00000000-0000-4000-8000-0000000041e1'::uuid from private.quiz_attempts where id = '00000000-0000-4000-8000-0000000041e1'::uuid), 'Un timeout révèle une tentative rejetée sur sa phase de révélation');

select * from finish();
rollback;
