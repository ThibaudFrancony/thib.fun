begin;

select plan(20);

create temporary table step3_function_sources (
  name text primary key,
  source text not null
) on commit drop;

insert into step3_function_sources (name, source)
values
  ('commit', pg_get_functiondef('public.server_commit_match(jsonb)'::regprocedure)),
  ('room_ready', pg_get_functiondef('public.server_set_room_ready(uuid, uuid, uuid, bigint, boolean)'::regprocedure)),
  ('finish_job', pg_get_functiondef('public.server_finish_job(uuid, uuid, text, text)'::regprocedure)),
  ('fail_job', pg_get_functiondef('public.server_fail_job(uuid, uuid, text)'::regprocedure)),
  ('claim', pg_get_functiondef('private.claim_due_jobs(integer)'::regprocedure)),
  ('dispatch', pg_get_functiondef('private.dispatch_due_jobs()'::regprocedure)),
  ('result', pg_get_functiondef('private.record_match_result(uuid, private.matches, jsonb, timestamptz)'::regprocedure)),
  ('technical', pg_get_functiondef('private.finalize_match_technical_error(uuid, private.matches, uuid, text, timestamptz)'::regprocedure)),
  ('abandoned', pg_get_functiondef('private.finalize_match_abandoned(uuid, private.matches, uuid, text, timestamptz)'::regprocedure));

select ok(
  (
    select position('from private.command_receipts' in lower(source)) > position('for update' in lower(source))
    from step3_function_sources where name = 'commit'
  ),
  'Expiration : le verrou de partie précède le reçu'
);

select ok(
  (
    select lower(source) like '%v_receipt_actor is distinct from v_actor_id%'
      and lower(source) like '%v_receipt_type is distinct from v_command_type%'
      and lower(source) like '%v_receipt_hash is distinct from v_command_hash%'
    from step3_function_sources where name = 'commit'
  ),
  'Payload modifié : acteur, type et hash sont revalidés'
);

select ok(
  (
    select lower(source) like '%v_command_type <> ''resign''%'
      and lower(source) like '%v_now >= v_match.deadline_at%'
      and lower(source) like '%''claim_forfeit''%'
    from step3_function_sources where name = 'commit'
  ),
  'Expiration à la limite : seul RESIGN reste admissible, le forfait est bloqué'
);

select ok(
  (
    select position('v_now := clock_timestamp()' in lower(source))
      > position('for update' in lower(source))
    from step3_function_sources where name = 'commit'
  ),
  'Horloge : la partie utilise l''heure PostgreSQL après le verrou'
);

select ok(
  (
    select lower(source) like '%v_job_kind = ''check_absence''%'
      and lower(source) like '%v_now - interval ''30 seconds''%'
      and lower(source) not like '%forfeit_not_available%'
      and lower(source) not like '%interval ''90 seconds''%'
    from step3_function_sources where name = 'commit'
  ),
  'Sortie : la grâce est de 30 secondes et le forfait n''existe plus'
);

select ok(
  (
    select lower(source) like '%v_job_kind = ''check_absence''%'
      and lower(source) like '%interval ''30 seconds''%'
      and lower(source) not like '%interval ''120 seconds''%'
      and lower(source) not like '%interval ''180 seconds''%'
    from step3_function_sources where name = 'commit'
  ),
  'Abandon : check_absence revalide une grâce unique sans phase'
);

select ok(
  (
    select lower(source) like '%jobstocancel%'
    from step3_function_sources where name = 'commit'
  ),
  'Concurrence : la transition reçoit une liste explicite de jobs à annuler'
);

select ok(
  (
    select lower(source) like '%where id = v_cancel_id%'
      and lower(source) like '%on conflict (dedupe_key) do nothing%'
      and position('if v_result is not null' in lower(source)) > 0
      and position(
        'and status in (''pending'', ''running'')'
        in substring(lower(source) from position('if v_result is not null' in lower(source)))
      ) > 0
    from step3_function_sources where name = 'commit'
  ),
  'Jobs : les remplacements explicites sont annulés, les terminaux invalident le reste et les clés sont idempotentes'
);

select ok(
  (
    select lower(source) like '%on conflict (match_id) do nothing%'
      and lower(source) like '%get diagnostics v_inserted = row_count%'
      and lower(source) like '%if v_inserted <> 1 then%'
    from step3_function_sources where name = 'result'
  ),
  'Finalisation unique : match_results est la frontière d''idempotence'
);

select ok(
  (
    select lower(source) like '%private.player_results%'
      and lower(source) like '%public.player_game_stats%'
      and lower(source) like '%public.history_entries%'
    from step3_function_sources where name = 'result'
  ),
  'Finalisation unique : résultats, statistiques et historique sont dans le même commit'
);

select ok(
  (
    select lower(source) like '%private.finalize_match_abandoned%'
      and lower(source) like '%''technical_error''%'
    from step3_function_sources where name = 'technical'
  )
  and (
    select lower(source) like '%''outcome'', ''abandoned''%'
      and lower(source) like '%''winnerid'', null%'
      and lower(source) like '%status = ''abandoned''%'
    from step3_function_sources where name = 'abandoned'
  ),
  'Abandon technique : technical_error ne fabrique pas de gagnant'
);

select ok(
  (
    select lower(source) like '%if v_job.attempts >= 5 then%'
      and lower(source) like '%private.finalize_match_technical_error%'
      and position('for update' in lower(source)) > 0
    from step3_function_sources where name = 'fail_job'
  ),
  'Reprise épuisée : le cinquième échec finalise techniquement sous verrou'
);

select ok(
  (
    select lower(source) like '%interval ''1 second''%'
      and lower(source) like '%interval ''2 seconds''%'
      and lower(source) like '%interval ''4 seconds''%'
      and lower(source) like '%interval ''8 seconds''%'
    from step3_function_sources where name = 'fail_job'
  ),
  'Reprise : les erreurs réessayables utilisent 1/2/4/8 secondes'
);

select ok(
  (
    select lower(source) like '%j.status = ''running'' and j.lease_until <= v_now%'
      and lower(source) like '%j.attempts < 5%'
    from step3_function_sources where name = 'claim'
  ),
  'Bail expiré : un job running est récupérable par le claim'
);

select ok(
  (
    select lower(source) like '%''jobid'', id%'
      and lower(source) like '%''leasetoken'', lease_token%'
      and lower(source) not like '%''matchid''%'
      and lower(source) not like '%''payload''%'
    from step3_function_sources where name = 'claim'
  ),
  'Dispatcher : le corps interne du worker reste limité à jobId/leaseToken'
);

select ok(
  (
    select lower(source) like '%body := jsonb_build_object(''jobs'', v_jobs)%'
      and lower(source) not like '%''matchid''%'
      and lower(source) not like '%''phaseid''%'
    from step3_function_sources where name = 'dispatch'
  ),
  'Dispatcher : le POST ne transmet pas l''état privé'
);

select ok(
  (
    select lower(source) like '%v_job.lease_until <= v_now%'
      and lower(source) like '%v_now := clock_timestamp()%'
      and position('from private.matches' in lower(source))
        < position('from private.jobs' in lower(source))
    from step3_function_sources where name = 'finish_job'
  ),
  'Bail expiré : finish_job verrouille la partie puis compare avec l''horloge PostgreSQL'
);

select ok(
  (
    select lower(source) like '%v_job.id::text || '':next''%'
      and lower(source) like '%on conflict (dedupe_key) do nothing%'
      and lower(source) like '%next_job.status in (''pending'', ''running'')%'
    from step3_function_sources where name = 'finish_job'
  ),
  'Reprise : le prochain check_absence reçoit une nouvelle clé dédupliquée'
);

select ok(
  (
    select position('from private.room_command_receipts' in lower(source))
      > position('for update' in lower(source))
      and (
        (
          lower(source) like '%v_receipt_actor is distinct from p_actor%'
          and lower(source) like '%v_receipt_hash is distinct from v_expected_hash%'
        )
        or (
          lower(source) like '%v_receipt.actor_id is distinct from p_actor%'
          and lower(source) like '%v_receipt.payload_hash is distinct from v_hash%'
        )
      )
    from step3_function_sources where name = 'room_ready'
  ),
  'Concurrence READY : le replay du salon est vérifié sous verrou'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'match_results_pkey')
    and exists (select 1 from pg_constraint where conname = 'player_results_pkey')
    and exists (select 1 from pg_constraint where conname = 'history_entries_pkey')
    and exists (select 1 from pg_constraint where conname = 'match_events_version_unique')
    and exists (select 1 from pg_constraint where conname = 'command_receipts_pkey')
    and exists (select 1 from pg_constraint where conname = 'job_receipts_pkey'),
  'Concurrence : résultats, historique, événements et reçus ont des clés uniques'
);

select * from finish();
rollback;
