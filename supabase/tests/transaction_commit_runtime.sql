begin;

select plan(36);

create temporary table step3_responses (
  name text primary key,
  response jsonb not null
) on commit drop;

create or replace function pg_temp.step3_seed_match(
  p_room_id uuid,
  p_match_id uuid,
  p_code text,
  p_phase_id uuid,
  p_deadline_at timestamptz
)
returns void
language plpgsql
as $$
begin
  insert into private.rooms (
    id, code, host_id, game_slug, config, status, version, expires_at
  )
  values (
    p_room_id,
    p_code,
    '00000000-0000-4000-8000-0000000000a1'::uuid,
    'geographie',
    '{}'::jsonb,
    'playing',
    1,
    clock_timestamp() + interval '1 hour'
  );

  insert into private.room_members (room_id, user_id, seat, ready, last_seen_at)
  values
    (p_room_id, '00000000-0000-4000-8000-0000000000a1'::uuid, 0, false, clock_timestamp()),
    (p_room_id, '00000000-0000-4000-8000-0000000000a2'::uuid, 1, false, clock_timestamp());

  insert into private.matches (
    id, room_id, game_slug, status, mode, config, rules_version,
    engine_version, state_schema_version, content_manifest, state, version,
    phase_id, deadline_at, deadline_kind
  )
  values (
    p_match_id,
    p_room_id,
    'geographie',
    'active',
    'random',
    '{}'::jsonb,
    'geographie-1',
    'geographie-engine-1',
    1,
    '{}'::jsonb,
    '{}'::jsonb,
    0,
    p_phase_id,
    p_deadline_at,
    case when p_deadline_at is null then null else 'turn_timeout' end
  );

  insert into private.match_players (
    match_id, user_id, seat, pseudo_snapshot, avatar_snapshot, last_seen_at
  )
  values
    (p_match_id, '00000000-0000-4000-8000-0000000000a1'::uuid, 0, 'Step3 Alice', '{}'::jsonb, clock_timestamp()),
    (p_match_id, '00000000-0000-4000-8000-0000000000a2'::uuid, 1, 'Step3 Bob', '{}'::jsonb, clock_timestamp());

  insert into public.match_views (match_id, viewer_id, version, payload)
  values
    (p_match_id, '00000000-0000-4000-8000-0000000000a1'::uuid, 0, '{"status":"active"}'::jsonb),
    (p_match_id, '00000000-0000-4000-8000-0000000000a2'::uuid, 0, '{"status":"active"}'::jsonb);

  update private.rooms
  set current_match_id = p_match_id
  where id = p_room_id;
end;
$$;

create or replace function pg_temp.step3_result(
  p_outcome text,
  p_winner uuid,
  p_reason text,
  p_alice_score numeric,
  p_bob_score numeric
)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'kind', 'competitive',
    'outcome', p_outcome,
    'winnerId', p_winner,
    'sharedScore', null,
    'reason', p_reason,
    'summary', jsonb_build_object('source', 'step3-runtime'),
    'players', jsonb_build_array(
      jsonb_build_object(
        'userId', '00000000-0000-4000-8000-0000000000a1'::uuid,
        'score', p_alice_score,
        'metrics', '{}'::jsonb
      ),
      jsonb_build_object(
        'userId', '00000000-0000-4000-8000-0000000000a2'::uuid,
        'score', p_bob_score,
        'metrics', '{}'::jsonb
      )
    )
  );
$$;

create or replace function pg_temp.step3_player_envelope(
  p_match_id uuid,
  p_command_id uuid,
  p_actor_id uuid,
  p_expected_version bigint,
  p_previous_phase uuid,
  p_command_type text,
  p_command_hash text,
  p_next_phase uuid,
  p_deadline_at timestamptz,
  p_deadline_kind text,
  p_result jsonb,
  p_event_type text,
  p_jobs_to_cancel jsonb,
  p_jobs_to_upsert jsonb
)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'matchId', p_match_id,
    'commandId', p_command_id,
    'actorId', p_actor_id,
    'expectedVersion', p_expected_version,
    'previousPhaseId', p_previous_phase,
    'commandType', p_command_type,
    'commandHash', p_command_hash,
    'source', 'player',
    'next', jsonb_build_object(
      'state', '{}'::jsonb,
      'phaseId', p_next_phase,
      'deadlineAt', p_deadline_at,
      'deadlineKind', p_deadline_kind
    ),
    'views', jsonb_build_array(
      jsonb_build_object('viewerId', '00000000-0000-4000-8000-0000000000a1'::uuid, 'payload', '{}'::jsonb),
      jsonb_build_object('viewerId', '00000000-0000-4000-8000-0000000000a2'::uuid, 'payload', '{}'::jsonb)
    ),
    'jobsToCancel', p_jobs_to_cancel,
    'jobsToUpsert', p_jobs_to_upsert,
    'roundRecords', '[]'::jsonb,
    'event', jsonb_build_object('type', p_event_type, 'payload', '{}'::jsonb),
    'result', p_result
  );
$$;

create or replace function pg_temp.step3_job_envelope(
  p_match_id uuid,
  p_job_id uuid,
  p_lease_token uuid,
  p_expected_version bigint,
  p_previous_phase uuid,
  p_command_type text,
  p_command_hash text,
  p_next_phase uuid,
  p_result jsonb,
  p_event_type text
)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'matchId', p_match_id,
    'commandId', p_job_id,
    'actorId', null,
    'expectedVersion', p_expected_version,
    'previousPhaseId', p_previous_phase,
    'commandType', p_command_type,
    'commandHash', p_command_hash,
    'source', 'job',
    'jobId', p_job_id,
    'leaseToken', p_lease_token,
    'next', jsonb_build_object(
      'state', '{}'::jsonb,
      'phaseId', p_next_phase,
      'deadlineAt', null,
      'deadlineKind', null
    ),
    'views', jsonb_build_array(
      jsonb_build_object('viewerId', '00000000-0000-4000-8000-0000000000a1'::uuid, 'payload', '{}'::jsonb),
      jsonb_build_object('viewerId', '00000000-0000-4000-8000-0000000000a2'::uuid, 'payload', '{}'::jsonb)
    ),
    'jobsToCancel', '[]'::jsonb,
    'jobsToUpsert', '[]'::jsonb,
    'roundRecords', '[]'::jsonb,
    'event', jsonb_build_object('type', p_event_type, 'payload', '{}'::jsonb),
    'result', p_result
  );
$$;

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
)
values
  (
    '00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated',
    'step3-alice@example.invalid', clock_timestamp(), '{}'::jsonb, '{}'::jsonb,
    clock_timestamp(), clock_timestamp(), false, false
  ),
  (
    '00000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated',
    'step3-bob@example.invalid', clock_timestamp(), '{}'::jsonb, '{}'::jsonb,
    clock_timestamp(), clock_timestamp(), false, false
  );

select ok(
  (select count(*) from public.profiles where id in (
    '00000000-0000-4000-8000-0000000000a1'::uuid,
    '00000000-0000-4000-8000-0000000000a2'::uuid
  )) = 2,
  'Le fixture SQL crée deux profils utilisables'
);

do $$
begin
  perform pg_temp.step3_seed_match(
    '00000000-0000-4000-8000-0000000000b1'::uuid,
    '00000000-0000-4000-8000-0000000000c1'::uuid,
    'R3A2BC',
    '00000000-0000-4000-8000-0000000000d1'::uuid,
    clock_timestamp() - interval '1 second'
  );
  perform pg_temp.step3_seed_match(
    '00000000-0000-4000-8000-0000000000b2'::uuid,
    '00000000-0000-4000-8000-0000000000c2'::uuid,
    'R3A2BD',
    '00000000-0000-4000-8000-0000000000d2'::uuid,
    clock_timestamp() - interval '1 second'
  );
  perform pg_temp.step3_seed_match(
    '00000000-0000-4000-8000-0000000000b3'::uuid,
    '00000000-0000-4000-8000-0000000000c3'::uuid,
    'R3A2BE',
    '00000000-0000-4000-8000-0000000000d3'::uuid,
    clock_timestamp() - interval '1 second'
  );
  perform pg_temp.step3_seed_match(
    '00000000-0000-4000-8000-0000000000b4'::uuid,
    '00000000-0000-4000-8000-0000000000c4'::uuid,
    'R3A2BF',
    '00000000-0000-4000-8000-0000000000d4'::uuid,
    clock_timestamp() - interval '1 second'
  );
  perform pg_temp.step3_seed_match(
    '00000000-0000-4000-8000-0000000000b5'::uuid,
    '00000000-0000-4000-8000-0000000000c5'::uuid,
    'R3A2BG',
    '00000000-0000-4000-8000-0000000000d5'::uuid,
    clock_timestamp() + interval '10 minutes'
  );
  perform pg_temp.step3_seed_match(
    '00000000-0000-4000-8000-0000000000b6'::uuid,
    '00000000-0000-4000-8000-0000000000c6'::uuid,
    'R3A2BH',
    '00000000-0000-4000-8000-0000000000d6'::uuid,
    clock_timestamp() + interval '10 minutes'
  );
  perform pg_temp.step3_seed_match(
    '00000000-0000-4000-8000-0000000000b7'::uuid,
    '00000000-0000-4000-8000-0000000000c7'::uuid,
    'R3A2BJ',
    '00000000-0000-4000-8000-0000000000d7'::uuid,
    clock_timestamp() + interval '10 minutes'
  );
  perform pg_temp.step3_seed_match(
    '00000000-0000-4000-8000-0000000000b8'::uuid,
    '00000000-0000-4000-8000-0000000000c8'::uuid,
    'R3A2BK',
    '00000000-0000-4000-8000-0000000000d8'::uuid,
    clock_timestamp() + interval '10 minutes'
  );
  perform pg_temp.step3_seed_match(
    '00000000-0000-4000-8000-0000000000b9'::uuid,
    '00000000-0000-4000-8000-0000000000c9'::uuid,
    'R3A2BL',
    '00000000-0000-4000-8000-0000000000d9'::uuid,
    clock_timestamp() + interval '10 minutes'
  );
end;
$$;

insert into private.jobs (
  id, match_id, kind, phase_id, dedupe_key, payload, run_at, status,
  attempts, lease_token, lease_until, completed_at
)
values
  (
    '00000000-0000-4000-8000-000000002001'::uuid,
    '00000000-0000-4000-8000-0000000000c5'::uuid,
    'check_absence', null, 'step3:absence',
    '{"matchId":"00000000-0000-4000-8000-0000000000c5","kind":"check_absence"}'::jsonb,
    clock_timestamp() - interval '1 second', 'running', 1,
    '00000000-0000-4000-8000-000000003001'::uuid,
    clock_timestamp() + interval '30 seconds', null
  ),
  (
    '00000000-0000-4000-8000-000000002002'::uuid,
    '00000000-0000-4000-8000-0000000000c6'::uuid,
    'turn_timeout', '00000000-0000-4000-8000-0000000000d6'::uuid, 'step3:expired-lease',
    '{}'::jsonb, clock_timestamp() - interval '1 second', 'running', 1,
    '00000000-0000-4000-8000-000000003002'::uuid,
    clock_timestamp() - interval '1 second', null
  ),
  (
    '00000000-0000-4000-8000-000000002003'::uuid,
    '00000000-0000-4000-8000-0000000000c7'::uuid,
    'turn_timeout', '00000000-0000-4000-8000-0000000000d7'::uuid, 'step3:retry',
    '{}'::jsonb, clock_timestamp() - interval '1 second', 'running', 1,
    '00000000-0000-4000-8000-000000003003'::uuid,
    clock_timestamp() + interval '30 seconds', null
  ),
  (
    '00000000-0000-4000-8000-000000002004'::uuid,
    '00000000-0000-4000-8000-0000000000c8'::uuid,
    'turn_timeout', '00000000-0000-4000-8000-0000000000d8'::uuid, 'step3:technical',
    '{}'::jsonb, clock_timestamp() - interval '1 second', 'running', 5,
    '00000000-0000-4000-8000-000000003004'::uuid,
    clock_timestamp() + interval '30 seconds', null
  ),
  (
    '00000000-0000-4000-8000-000000002005'::uuid,
    '00000000-0000-4000-8000-0000000000c8'::uuid,
    'check_absence', null, 'step3:technical-other',
    '{}'::jsonb, clock_timestamp() + interval '10 minutes', 'pending', 0,
    null, null, null
  ),
  (
    '00000000-0000-4000-8000-000000002006'::uuid,
    '00000000-0000-4000-8000-0000000000c9'::uuid,
    'turn_timeout', '00000000-0000-4000-8000-0000000000d9'::uuid, 'step3:cancel',
    '{}'::jsonb, clock_timestamp() + interval '10 minutes', 'pending', 0,
    null, null, null
  ),
  (
    '00000000-0000-4000-8000-000000002007'::uuid,
    '00000000-0000-4000-8000-0000000000c9'::uuid,
    'turn_timeout', '00000000-0000-4000-8000-0000000000d9'::uuid, 'step3:keep',
    '{}'::jsonb, clock_timestamp() + interval '10 minutes', 'pending', 0,
    null, null, null
  ),
  (
    '00000000-0000-4000-8000-000000002008'::uuid,
    '00000000-0000-4000-8000-0000000000c9'::uuid,
    'turn_timeout', '00000000-0000-4000-8000-0000000000d9'::uuid, 'step3:terminal',
    '{}'::jsonb, clock_timestamp() - interval '1 minute', 'done', 1,
    null, null, clock_timestamp() - interval '30 seconds'
  ),
  (
    '00000000-0000-4000-8000-000000002009'::uuid,
    '00000000-0000-4000-8000-0000000000c9'::uuid,
    'check_absence', null, 'step3:absence-existing',
    '{}'::jsonb, clock_timestamp() + interval '10 minutes', 'pending', 0,
    null, null, null
  ),
  (
    '00000000-0000-4000-8000-000000002010'::uuid,
    '00000000-0000-4000-8000-0000000000c2'::uuid,
    'turn_timeout', '00000000-0000-4000-8000-0000000000d2'::uuid, 'step3:resign-other',
    '{}'::jsonb, clock_timestamp() + interval '10 minutes', 'pending', 0,
    null, null, null
  );

update private.match_players
set last_seen_at = clock_timestamp() - interval '91 seconds'
where match_id = '00000000-0000-4000-8000-0000000000c4'::uuid
  and seat = 1;

update private.match_players
set last_seen_at = clock_timestamp() - interval '30 seconds'
where match_id = '00000000-0000-4000-8000-0000000000c3'::uuid
  and seat = 1;

update private.match_players
set last_seen_at = clock_timestamp() - interval '121 seconds'
where match_id = '00000000-0000-4000-8000-0000000000c5'::uuid;

select throws_ok(
  $q$
    select public.server_commit_match(
      pg_temp.step3_player_envelope(
        '00000000-0000-4000-8000-0000000000c1'::uuid,
        '00000000-0000-4000-8000-000000001001'::uuid,
        '00000000-0000-4000-8000-0000000000a1'::uuid,
        0,
        '00000000-0000-4000-8000-0000000000d1'::uuid,
        'MOVE', repeat('1', 64),
        '00000000-0000-4000-8000-0000000000e1'::uuid,
        null, null, null::jsonb, 'MOVE', '[]'::jsonb, '[]'::jsonb
      )
    )
  $q$,
  'P0001',
  'DEADLINE_EXPIRED',
  'Un coup ordinaire à l''échéance est rejeté'
);

select is(
  (select version from private.matches where id = '00000000-0000-4000-8000-0000000000c1'::uuid),
  0::bigint,
  'Le refus d''expiration ne modifie pas la version'
);
select is(
  (select count(*) from private.command_receipts where match_id = '00000000-0000-4000-8000-0000000000c1'::uuid),
  0::bigint,
  'Le refus d''expiration ne consomme pas de reçu'
);

insert into step3_responses (name, response)
select
  'resign',
  public.server_commit_match(
    pg_temp.step3_player_envelope(
      '00000000-0000-4000-8000-0000000000c2'::uuid,
      '00000000-0000-4000-8000-000000001002'::uuid,
      '00000000-0000-4000-8000-0000000000a1'::uuid,
      0,
      '00000000-0000-4000-8000-0000000000d2'::uuid,
      'RESIGN', repeat('2', 64),
      '00000000-0000-4000-8000-0000000000e2'::uuid,
      null, null,
      pg_temp.step3_result(
        'win',
        '00000000-0000-4000-8000-0000000000a2'::uuid,
        'resign',
        2,
        1
      ),
      'PLAYER_RESIGNED', '[]'::jsonb, '[]'::jsonb
    )
  );

select is(
  (select response->>'version' from step3_responses where name = 'resign'),
  '1',
  'RESIGN reste admissible après expiration'
);
select is(
  (select status from private.matches where id = '00000000-0000-4000-8000-0000000000c2'::uuid),
  'completed',
  'RESIGN finalise la partie'
);
select is(
  (select winner_id from private.match_results where match_id = '00000000-0000-4000-8000-0000000000c2'::uuid),
  '00000000-0000-4000-8000-0000000000a2'::uuid,
  'RESIGN attribue la victoire à l''adversaire'
);
select is(
  (select count(*) from public.history_entries where match_id = '00000000-0000-4000-8000-0000000000c2'::uuid),
  2::bigint,
  'La finalisation écrit les deux historiques'
);
select ok(
  (select count(*) from public.player_game_stats
   where user_id in (
     '00000000-0000-4000-8000-0000000000a1'::uuid,
     '00000000-0000-4000-8000-0000000000a2'::uuid
   )
   and game_slug = 'geographie'
   and played = 1) = 2,
  'La finalisation incrémente les statistiques une seule fois'
);

select is(
  (
    select public.server_commit_match(
      pg_temp.step3_player_envelope(
        '00000000-0000-4000-8000-0000000000c2'::uuid,
        '00000000-0000-4000-8000-000000001002'::uuid,
        '00000000-0000-4000-8000-0000000000a1'::uuid,
        0,
        '00000000-0000-4000-8000-0000000000d2'::uuid,
        'RESIGN', repeat('2', 64),
        '00000000-0000-4000-8000-0000000000e2'::uuid,
        null, null,
        pg_temp.step3_result(
          'win',
          '00000000-0000-4000-8000-0000000000a2'::uuid,
          'resign',
          2,
          1
        ),
        'PLAYER_RESIGNED', '[]'::jsonb, '[]'::jsonb
      )
    )
  ),
  (select response from step3_responses where name = 'resign'),
  'Le second clic identique rejoue exactement la réponse'
);
select ok(
  (select count(*) from public.history_entries where match_id = '00000000-0000-4000-8000-0000000000c2'::uuid) = 2
    and (select count(*) from private.player_results where match_id = '00000000-0000-4000-8000-0000000000c2'::uuid) = 2,
  'Le replay ne double ni résultat ni historique'
);
select is(
  (select status from private.jobs where id = '00000000-0000-4000-8000-000000002010'::uuid),
  'cancelled',
  'Une finalisation terminale annule les autres jobs exécutables'
);
select throws_ok(
  $q$
    select public.server_commit_match(
      pg_temp.step3_player_envelope(
        '00000000-0000-4000-8000-0000000000c2'::uuid,
        '00000000-0000-4000-8000-000000001002'::uuid,
        '00000000-0000-4000-8000-0000000000a1'::uuid,
        0,
        '00000000-0000-4000-8000-0000000000d2'::uuid,
        'RESIGN', repeat('3', 64),
        '00000000-0000-4000-8000-0000000000e2'::uuid,
        null, null,
        pg_temp.step3_result(
          'win',
          '00000000-0000-4000-8000-0000000000a2'::uuid,
          'resign',
          2,
          1
        ),
        'PLAYER_RESIGNED', '[]'::jsonb, '[]'::jsonb
      )
    )
  $q$,
  'P0001',
  'COMMAND_ID_REUSED',
  'Un payload modifié est refusé par le reçu'
);
select is(
  (select count(*) from private.command_receipts where match_id = '00000000-0000-4000-8000-0000000000c2'::uuid),
  1::bigint,
  'Le payload modifié ne crée pas un second reçu'
);

select throws_ok(
  $q$
    select public.server_commit_match(
      pg_temp.step3_player_envelope(
        '00000000-0000-4000-8000-0000000000c3'::uuid,
        '00000000-0000-4000-8000-000000001003'::uuid,
        '00000000-0000-4000-8000-0000000000a1'::uuid,
        0,
        '00000000-0000-4000-8000-0000000000d3'::uuid,
        'CLAIM_FORFEIT', repeat('4', 64),
        '00000000-0000-4000-8000-0000000000e3'::uuid,
        null, null,
        pg_temp.step3_result(
          'win',
          '00000000-0000-4000-8000-0000000000a1'::uuid,
          'claimed_forfeit',
          null,
          null
        ),
        'FORFEIT_CLAIMED', '[]'::jsonb, '[]'::jsonb
      )
    )
  $q$,
  'P0001',
  'FORFEIT_NOT_AVAILABLE',
  'Le forfait est refusé avant 90 secondes d''absence'
);

select is(
  (select status from private.matches where id = '00000000-0000-4000-8000-0000000000c4'::uuid),
  'active',
  'Le refus de forfait conserve la partie active'
);

insert into step3_responses (name, response)
select 'forfeit', public.server_commit_match(
  pg_temp.step3_player_envelope(
    '00000000-0000-4000-8000-0000000000c4'::uuid,
    '00000000-0000-4000-8000-000000001004'::uuid,
    '00000000-0000-4000-8000-0000000000a1'::uuid,
    0,
    '00000000-0000-4000-8000-0000000000d4'::uuid,
    'CLAIM_FORFEIT', repeat('5', 64),
    '00000000-0000-4000-8000-0000000000e4'::uuid,
    null, null,
    pg_temp.step3_result(
      'win',
      '00000000-0000-4000-8000-0000000000a1'::uuid,
      'claimed_forfeit',
      null,
      null
    ),
    'FORFEIT_CLAIMED', '[]'::jsonb, '[]'::jsonb
  )
);

select is(
  (select status from private.matches where id = '00000000-0000-4000-8000-0000000000c4'::uuid),
  'completed',
  'Le forfait est accepté après l''absence requise'
);
select is(
  (select winner_id from private.match_results where match_id = '00000000-0000-4000-8000-0000000000c4'::uuid),
  '00000000-0000-4000-8000-0000000000a1'::uuid,
  'Le forfait attribue la victoire au demandeur'
);

insert into step3_responses (name, response)
select 'absence', public.server_commit_match(
  pg_temp.step3_job_envelope(
    '00000000-0000-4000-8000-0000000000c5'::uuid,
    '00000000-0000-4000-8000-000000002001'::uuid,
    '00000000-0000-4000-8000-000000003001'::uuid,
    0,
    '00000000-0000-4000-8000-0000000000d5'::uuid,
    'check_absence', repeat('6', 64),
    '00000000-0000-4000-8000-0000000000e5'::uuid,
    pg_temp.step3_result('abandoned', null, 'absence', null, null),
    'MATCH_ABANDONED'
  )
);

select is(
  (select status from private.matches where id = '00000000-0000-4000-8000-0000000000c5'::uuid),
  'abandoned',
  'check_absence abandonne la partie lorsque la condition est vraie'
);
select ok(
  (select outcome = 'abandoned' and winner_id is null and reason = 'absence'
   from private.match_results
   where match_id = '00000000-0000-4000-8000-0000000000c5'::uuid),
  'Un abandon ne fabrique pas de gagnant'
);
select ok(
  (select status = 'done' from private.jobs where id = '00000000-0000-4000-8000-000000002001'::uuid)
    and (select count(*) from private.job_receipts where job_id = '00000000-0000-4000-8000-000000002001'::uuid) = 1,
  'La réussite d''un job écrit son état terminal et son reçu'
);

select throws_ok(
  $q$select public.server_finish_job(
    '00000000-0000-4000-8000-000000002002'::uuid,
    '00000000-0000-4000-8000-000000003002'::uuid,
    'done',
    null
  )$q$,
  'P0001',
  'JOB_LEASE_INVALID',
  'Un bail expiré ne peut pas clôturer un job'
);
select throws_ok(
  $q$
    select public.server_commit_match(
      pg_temp.step3_job_envelope(
        '00000000-0000-4000-8000-0000000000c6'::uuid,
        '00000000-0000-4000-8000-000000002002'::uuid,
        '00000000-0000-4000-8000-000000003002'::uuid,
        0,
        '00000000-0000-4000-8000-0000000000d6'::uuid,
        'turn_timeout', repeat('7', 64),
        '00000000-0000-4000-8000-0000000000e6'::uuid,
        null,
        'TURN_TIMEOUT'
      )
    )
  $q$,
  'P0001',
  'JOB_LEASE_INVALID',
  'Un commit système avec bail expiré ne mute pas la partie'
);

select is(
  (
    select public.server_fail_job(
      '00000000-0000-4000-8000-000000002003'::uuid,
      '00000000-0000-4000-8000-000000003003'::uuid,
      'WORKER_ERROR'
    )->>'status'
  ),
  'pending',
  'Une panne réessayable remet le job en attente'
);
select ok(
  (select attempts = 1 and lease_token is null and lease_until is null and last_error_code = 'WORKER_ERROR'
   from private.jobs
   where id = '00000000-0000-4000-8000-000000002003'::uuid),
  'Le retry conserve le compteur et libère le bail'
);
select ok(
  (select run_at > clock_timestamp() from private.jobs where id = '00000000-0000-4000-8000-000000002003'::uuid),
  'Le retry est planifié dans le futur avec l''horloge DB'
);

insert into step3_responses (name, response)
select 'technical', public.server_fail_job(
  '00000000-0000-4000-8000-000000002004'::uuid,
  '00000000-0000-4000-8000-000000003004'::uuid,
  'WORKER_ERROR'
);

select is(
  (select status from private.matches where id = '00000000-0000-4000-8000-0000000000c8'::uuid),
  'abandoned',
  'Le cinquième échec abandonne techniquement la partie'
);
select ok(
  (select outcome = 'abandoned' and winner_id is null and reason = 'technical_error'
   from private.match_results
   where match_id = '00000000-0000-4000-8000-0000000000c8'::uuid),
  'technical_error conserve une issue sans gagnant'
);
select is(
  (select status from private.jobs where id = '00000000-0000-4000-8000-000000002004'::uuid),
  'failed',
  'Le job au cinquième échec devient failed'
);
select is(
  (select status from private.jobs where id = '00000000-0000-4000-8000-000000002005'::uuid),
  'cancelled',
  'La finalisation technique annule les autres jobs exécutables'
);

insert into step3_responses (name, response)
select 'transition', public.server_commit_match(
  pg_temp.step3_player_envelope(
    '00000000-0000-4000-8000-0000000000c9'::uuid,
    '00000000-0000-4000-8000-000000001009'::uuid,
    '00000000-0000-4000-8000-0000000000a1'::uuid,
    0,
    '00000000-0000-4000-8000-0000000000d9'::uuid,
    'MOVE', repeat('8', 64),
    '00000000-0000-4000-8000-0000000000d9'::uuid,
    clock_timestamp() + interval '20 minutes', 'turn_timeout', null::jsonb, 'MOVE',
    jsonb_build_array('00000000-0000-4000-8000-000000002006'::uuid),
    jsonb_build_array(
      jsonb_build_object(
        'kind', 'turn_timeout',
        'phaseId', '00000000-0000-4000-8000-0000000000d9'::uuid,
        'dedupeKey', 'step3:replacement',
        'payload', jsonb_build_object('kind', 'turn_timeout'),
        'runAt', clock_timestamp() + interval '10 minutes'
      ),
      jsonb_build_object(
        'kind', 'turn_timeout',
        'phaseId', '00000000-0000-4000-8000-0000000000d9'::uuid,
        'dedupeKey', 'step3:terminal',
        'payload', jsonb_build_object('kind', 'turn_timeout'),
        'runAt', clock_timestamp() + interval '10 minutes'
      )
    )
  )
);

select is(
  (select status from private.jobs where id = '00000000-0000-4000-8000-000000002006'::uuid),
  'cancelled',
  'Seul le job explicitement remplacé est annulé'
);
select is(
  (select status from private.jobs where id = '00000000-0000-4000-8000-000000002007'::uuid),
  'pending',
  'Un job encore valide est conservé'
);
select is(
  (select status from private.jobs where dedupe_key = 'step3:replacement'),
  'pending',
  'Le remplacement reçoit sa propre clé de déduplication'
);
select is(
  (select status from private.jobs where id = '00000000-0000-4000-8000-000000002008'::uuid),
  'done',
  'Un job terminal n''est pas réactivé par un upsert'
);
select ok(
  (select count(*) from private.jobs
   where match_id = '00000000-0000-4000-8000-0000000000c9'::uuid
     and kind = 'check_absence'
     and status = 'pending') = 1,
  'La transition active conserve un check_absence périodique'
);
select is(
  (select version from private.matches where id = '00000000-0000-4000-8000-0000000000c9'::uuid),
  1::bigint,
  'Une transition concurrente sérialisée ne produit qu''une nouvelle version'
);

select * from finish();
rollback;
