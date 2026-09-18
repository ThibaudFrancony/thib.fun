begin;

select plan(22);

-- ---------------------------------------------------------------------------
-- Structure et privilèges
-- ---------------------------------------------------------------------------

select ok(
  (
    select is_nullable from information_schema.columns
    where table_schema = 'private' and table_name = 'rooms' and column_name = 'game_slug'
  ) = 'YES',
  'Étape 11 : rooms.game_slug accepte NULL'
);

select ok(
  exists (select 1 from pg_proc where oid = 'public.server_get_active_lobby(uuid)'::regprocedure)
    and not (select prosecdef from pg_proc where oid = 'public.server_get_active_lobby(uuid)'::regprocedure),
  'Étape 11 : get_active_lobby existe en SECURITY INVOKER'
);

select ok(
  has_function_privilege('service_role', 'public.server_get_active_lobby(uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.server_get_active_lobby(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.server_get_active_lobby(uuid)', 'EXECUTE'),
  'Étape 11 : get_active_lobby est réservé au rôle serveur'
);

select ok(
  exists (select 1 from pg_proc where oid = 'public.server_create_lobby(uuid, uuid)'::regprocedure)
    and not (select prosecdef from pg_proc where oid = 'public.server_create_lobby(uuid, uuid)'::regprocedure),
  'Étape 11 : create_lobby existe en SECURITY INVOKER'
);

select ok(
  has_function_privilege('service_role', 'public.server_create_lobby(uuid, uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.server_create_lobby(uuid, uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.server_create_lobby(uuid, uuid)', 'EXECUTE'),
  'Étape 11 : create_lobby est réservé au rôle serveur'
);

select ok(
  position(
    'v_room.game_slug is null'
    in pg_get_functiondef('public.server_start_match(uuid, uuid, uuid, bigint, uuid, text, jsonb, jsonb, uuid, timestamptz, text, jsonb, jsonb, jsonb, text, text, integer)'::regprocedure)
  ) > 0,
  'Étape 11 : START refuse explicitement un salon sans jeu'
);

select ok(
  exists (select 1 from pg_proc where oid = 'public.server_prepare_lobby_match(uuid, uuid, uuid, bigint, text, jsonb)'::regprocedure)
    and not (select prosecdef from pg_proc where oid = 'public.server_prepare_lobby_match(uuid, uuid, uuid, bigint, text, jsonb)'::regprocedure),
  'Étape 11 : prepare_lobby_match existe en SECURITY INVOKER'
);

select ok(
  has_function_privilege('service_role', 'public.server_prepare_lobby_match(uuid, uuid, uuid, bigint, text, jsonb)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.server_prepare_lobby_match(uuid, uuid, uuid, bigint, text, jsonb)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.server_prepare_lobby_match(uuid, uuid, uuid, bigint, text, jsonb)', 'EXECUTE'),
  'Étape 11 : prepare_lobby_match est réservé au rôle serveur'
);

-- ---------------------------------------------------------------------------
-- Scénario : créer, inviter, choisir le jeu, quitter
-- ---------------------------------------------------------------------------

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
)
values
  (
    '00000000-0000-4000-8000-0000000000e1', 'authenticated', 'authenticated',
    'step11-alice@example.invalid', clock_timestamp(), '{}'::jsonb, '{}'::jsonb,
    clock_timestamp(), clock_timestamp(), false, false
  ),
  (
    '00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated',
    'step11-bob@example.invalid', clock_timestamp(), '{}'::jsonb, '{}'::jsonb,
    clock_timestamp(), clock_timestamp(), false, false
  );

create temp table step11_ctx as
select (result->>'roomId')::uuid as room_id, result->>'code' as code
from (
  select public.server_create_lobby(
    '00000000-0000-4000-8000-0000000000e1'::uuid,
    '00000000-0000-4000-8000-000000001101'::uuid
  ) as result
) s;

select ok(
  (select room_id is not null and char_length(code) = 6 from step11_ctx),
  'Étape 11 : create_lobby crée un salon avec un code à 6 caractères'
);

select ok(
  exists (
    select 1
    from private.rooms r
    join private.room_members rm on rm.room_id = r.id
    where r.id = (select room_id from step11_ctx)
      and r.game_slug is null
      and r.status = 'waiting'
      and rm.user_id = '00000000-0000-4000-8000-0000000000e1'::uuid
      and rm.seat = 0
  ),
  'Étape 11 : le salon générique est en attente, sans jeu, hôte au siège 0'
);

select is(
  (
    public.server_create_lobby(
      '00000000-0000-4000-8000-0000000000e1'::uuid,
      '00000000-0000-4000-8000-000000001102'::uuid
    )->>'roomId'
  )::uuid,
  (select room_id from step11_ctx),
  'Étape 11 : un membre n''a qu''un seul salon générique actif'
);

select ok(
  (
    public.server_get_active_lobby('00000000-0000-4000-8000-0000000000e1'::uuid)->>'gameSlug'
  ) is null,
  'Étape 11 : get_active_lobby renvoie un salon sans jeu'
);

select ok(
  (
    public.server_get_active_lobby('00000000-0000-4000-8000-0000000000e1'::uuid)->>'roomId'
  )::uuid = (select room_id from step11_ctx),
  'Étape 11 : l''hôte retrouve son salon générique actif'
);

select ok(
  public.server_get_active_lobby('00000000-0000-4000-8000-0000000000e2'::uuid) is null,
  'Étape 11 : un non-membre n''a pas de salon actif'
);

select ok(
  (
    public.server_join_room(
      '00000000-0000-4000-8000-0000000000e2'::uuid,
      '00000000-0000-4000-8000-000000001103'::uuid,
      (select code from step11_ctx)
    )->>'roomId'
  )::uuid = (select room_id from step11_ctx),
  'Étape 11 : le second joueur rejoint le salon générique par code'
);

select ok(
  (select count(*) from private.room_members where room_id = (select room_id from step11_ctx)) = 2
    and public.server_get_active_lobby('00000000-0000-4000-8000-0000000000e2'::uuid) is not null,
  'Étape 11 : le salon générique réunit les deux joueurs'
);

select throws_ok(
  $q$
    select public.server_change_room(
      '00000000-0000-4000-8000-0000000000e2'::uuid,
      '00000000-0000-4000-8000-000000001104'::uuid,
      (select room_id from step11_ctx),
      (select version from private.rooms where id = (select room_id from step11_ctx)),
      '{"type":"SET_CONFIG","gameSlug":"uno","config":{}}'::jsonb
    )
  $q$,
  'P0001',
  'HOST_REQUIRED',
  'Étape 11 : seul l''hôte choisit le jeu'
);

select throws_ok(
  $q$
    select public.server_start_match(
      '00000000-0000-4000-8000-0000000000e1'::uuid,
      '00000000-0000-4000-8000-000000001105'::uuid,
      (select room_id from step11_ctx),
      (select version from private.rooms where id = (select room_id from step11_ctx)),
      '00000000-0000-4000-8000-000000001201'::uuid,
      'random', '{}'::jsonb, '{}'::jsonb,
      '00000000-0000-4000-8000-000000001301'::uuid,
      clock_timestamp() + interval '60 seconds', 'turn',
      '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, 'r1', 'e1', 1
    )
  $q$,
  'P0001',
  'GAME_NOT_READY',
  'Étape 11 : impossible de lancer une partie sans jeu choisi'
);

select is(
  public.server_prepare_lobby_match(
    '00000000-0000-4000-8000-0000000000e1'::uuid,
    '00000000-0000-4000-8000-000000001106'::uuid,
    (select room_id from step11_ctx),
    (select version from private.rooms where id = (select room_id from step11_ctx)),
    'uno',
    '{"turnSeconds":30}'::jsonb
  )->>'gameSlug',
  'uno',
  'Étape 11 : l''hôte prépare le jeu depuis le salon générique'
);

select ok(
  (select game_slug from private.rooms where id = (select room_id from step11_ctx)) = 'uno'
    and not exists (
      select 1 from private.room_members
      where room_id = (select room_id from step11_ctx) and not ready
    ),
  'Étape 11 : préparer le jeu arme les deux joueurs prêts'
);

create temp table step11_leave as
select public.server_change_room(
  '00000000-0000-4000-8000-0000000000e1'::uuid,
  '00000000-0000-4000-8000-000000001107'::uuid,
  (select room_id from step11_ctx),
  (select version from private.rooms where id = (select room_id from step11_ctx)),
  '{"type":"LEAVE"}'::jsonb
) as response;

select ok(
  (select (response->>'left')::boolean from step11_leave)
    and (select host_id from private.rooms where id = (select room_id from step11_ctx)) = '00000000-0000-4000-8000-0000000000e2'::uuid
    and (select count(*) from private.room_members where room_id = (select room_id from step11_ctx)) = 1,
  'Étape 11 : l''hôte qui quitte laisse le second joueur hôte du salon'
);

create temp table step11_close as
select public.server_change_room(
  '00000000-0000-4000-8000-0000000000e2'::uuid,
  '00000000-0000-4000-8000-000000001108'::uuid,
  (select room_id from step11_ctx),
  (select version from private.rooms where id = (select room_id from step11_ctx)),
  '{"type":"LEAVE"}'::jsonb
) as response;

select ok(
  (select (response->>'closed')::boolean from step11_close)
    and (select status from private.rooms where id = (select room_id from step11_ctx)) = 'closed'
    and public.server_get_active_lobby('00000000-0000-4000-8000-0000000000e2'::uuid) is null,
  'Étape 11 : le dernier joueur ferme le salon, qui n''est plus actif'
);

select * from finish();
rollback;
