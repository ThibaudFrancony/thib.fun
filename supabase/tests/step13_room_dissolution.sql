begin;

select plan(17);

-- ---------------------------------------------------------------------------
-- Structure et privilèges
-- ---------------------------------------------------------------------------

select ok(
  exists (select 1 from pg_proc where oid = 'private.dissolve_inactive_rooms(integer)'::regprocedure)
    and not (select prosecdef from pg_proc where oid = 'private.dissolve_inactive_rooms(integer)'::regprocedure),
  'Étape 13 : le balayage des salons inactifs existe en SECURITY INVOKER'
);

select ok(
  not has_function_privilege('authenticated', 'private.dissolve_inactive_rooms(integer)', 'EXECUTE')
    and not has_function_privilege('anon', 'private.dissolve_inactive_rooms(integer)', 'EXECUTE'),
  'Étape 13 : le balayage reste inexploitable par les clients'
);

select ok(
  exists (
    select 1 from cron.job
    where jobname = 'tibo-fun-dissolve-inactive-rooms'
      and active
      and schedule = '30 seconds'
      and command like '%private.dissolve_inactive_rooms%'
  ),
  'Étape 13 : le cron de dissolution est actif toutes les 30 s'
);

select ok(
  position('status = ''waiting''' in pg_get_functiondef('private.dissolve_inactive_rooms(integer)'::regprocedure)) > 0
    and position('interval ''1 hour''' in pg_get_functiondef('private.dissolve_inactive_rooms(integer)'::regprocedure)) > 0
    and position('for update skip locked' in lower(pg_get_functiondef('private.dissolve_inactive_rooms(integer)'::regprocedure))) > 0,
  'Étape 13 : seuls les salons en attente sans activité ni présence depuis 1 h sont visés'
);

select ok(
  position('interval ''1 hour''' in pg_get_functiondef('public.server_room_heartbeat(uuid, uuid)'::regprocedure)) > 0
    and position('v_room.expires_at <= clock_timestamp()' in pg_get_functiondef('public.server_room_heartbeat(uuid, uuid)'::regprocedure)) > 0,
  'Étape 13 : le heartbeat ferme aussi un salon inactif depuis 1 h sans perdre l''échéance 24 h'
);

-- ---------------------------------------------------------------------------
-- Fixtures : Alice et Bob, un salon générique frais
-- ---------------------------------------------------------------------------

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
)
values
  (
    '00000000-0000-4000-8000-0000000013e1', 'authenticated', 'authenticated',
    'step13-alice@example.invalid', clock_timestamp(), '{}'::jsonb, '{}'::jsonb,
    clock_timestamp(), clock_timestamp(), false, false
  ),
  (
    '00000000-0000-4000-8000-0000000013e2', 'authenticated', 'authenticated',
    'step13-bob@example.invalid', clock_timestamp(), '{}'::jsonb, '{}'::jsonb,
    clock_timestamp(), clock_timestamp(), false, false
  );

create temp table step13_ctx as
select (result->>'roomId')::uuid as room_id
from (
  select public.server_create_lobby(
    '00000000-0000-4000-8000-0000000013e1'::uuid,
    '00000000-0000-4000-8000-000000001301'::uuid
  ) as result
) s;

select is(
  private.dissolve_inactive_rooms(),
  0,
  'Étape 13 : un salon frais n''est pas dissous'
);

select is(
  (select status from private.rooms where id = (select room_id from step13_ctx)),
  'waiting',
  'Étape 13 : le salon frais reste en attente'
);

-- ---------------------------------------------------------------------------
-- Scénario : salon sans partie ni présence depuis plus d'une heure
-- ---------------------------------------------------------------------------

alter table private.rooms disable trigger rooms_touch_updated_at;
update private.rooms
set updated_at = clock_timestamp() - interval '2 hours'
where id = (select room_id from step13_ctx);
alter table private.rooms enable trigger rooms_touch_updated_at;
update private.room_members
set last_seen_at = clock_timestamp() - interval '2 hours'
where room_id = (select room_id from step13_ctx);

select is(
  private.dissolve_inactive_rooms(),
  1,
  'Étape 13 : le salon inactif depuis 2 h est dissous'
);

select ok(
  (
    select status = 'closed' and version >= 2
    from private.rooms
    where id = (select room_id from step13_ctx)
  ),
  'Étape 13 : la dissolution ferme le salon et incrémente sa version'
);

select is(
  (
    select payload->>'status'
    from public.room_views
    where room_id = (select room_id from step13_ctx)
      and viewer_id = '00000000-0000-4000-8000-0000000013e1'::uuid
  ),
  'closed',
  'Étape 13 : la projection des membres bascule sur closed'
);

select ok(
  public.server_get_active_room('00000000-0000-4000-8000-0000000013e1'::uuid) is null,
  'Étape 13 : un salon dissous n''est plus le salon actif du joueur'
);

-- ---------------------------------------------------------------------------
-- Scénario : activité ancienne mais présence récente (heartbeat)
-- ---------------------------------------------------------------------------

create temp table step13_presence as
select (result->>'roomId')::uuid as room_id
from (
  select public.server_create_room(
    '00000000-0000-4000-8000-0000000013e1'::uuid,
    '00000000-0000-4000-8000-000000001302'::uuid,
    'geographie',
    '{}'::jsonb
  ) as result
) s;

alter table private.rooms disable trigger rooms_touch_updated_at;
update private.rooms
set updated_at = clock_timestamp() - interval '2 hours'
where id = (select room_id from step13_presence);
alter table private.rooms enable trigger rooms_touch_updated_at;
update private.room_members
set last_seen_at = clock_timestamp() - interval '30 minutes'
where room_id = (select room_id from step13_presence);

select is(
  private.dissolve_inactive_rooms(),
  0,
  'Étape 13 : aucun salon n''est dissous quand un joueur est présent depuis moins d''une heure'
);

select is(
  (select status from private.rooms where id = (select room_id from step13_presence)),
  'waiting',
  'Étape 13 : la présence récente prolonge le salon'
);

-- ---------------------------------------------------------------------------
-- Scénario : une partie active n'est jamais dissoute
-- ---------------------------------------------------------------------------

create temp table step13_playing as
select (result->>'roomId')::uuid as room_id
from (
  select public.server_create_room(
    '00000000-0000-4000-8000-0000000013e2'::uuid,
    '00000000-0000-4000-8000-000000001303'::uuid,
    'geographie',
    '{}'::jsonb
  ) as result
) s;

alter table private.rooms disable trigger rooms_touch_updated_at;
update private.rooms
set status = 'playing', updated_at = clock_timestamp() - interval '3 hours'
where id = (select room_id from step13_playing);
alter table private.rooms enable trigger rooms_touch_updated_at;
update private.room_members
set last_seen_at = clock_timestamp() - interval '3 hours'
where room_id = (select room_id from step13_playing);

select is(
  private.dissolve_inactive_rooms(),
  0,
  'Étape 13 : un salon en cours de partie est ignoré par le balayage'
);

select is(
  (select status from private.rooms where id = (select room_id from step13_playing)),
  'playing',
  'Étape 13 : la partie active reste en cours'
);

-- ---------------------------------------------------------------------------
-- Scénario : le heartbeat ferme un salon inactif sans attendre le cron
-- ---------------------------------------------------------------------------

create temp table step13_heartbeat as
select (result->>'roomId')::uuid as room_id
from (
  select public.server_create_room(
    '00000000-0000-4000-8000-0000000013e2'::uuid,
    '00000000-0000-4000-8000-000000001304'::uuid,
    'geographie',
    '{}'::jsonb
  ) as result
) s;

alter table private.rooms disable trigger rooms_touch_updated_at;
update private.rooms
set updated_at = clock_timestamp() - interval '2 hours'
where id = (select room_id from step13_heartbeat);
alter table private.rooms enable trigger rooms_touch_updated_at;
update private.room_members
set last_seen_at = clock_timestamp() - interval '2 hours'
where room_id = (select room_id from step13_heartbeat);

select is(
  public.server_room_heartbeat(
    '00000000-0000-4000-8000-0000000013e2'::uuid,
    (select room_id from step13_heartbeat)
  )->>'status',
  'closed',
  'Étape 13 : le heartbeat ferme un salon inactif depuis plus d''une heure'
);

select is(
  private.dissolve_inactive_rooms(),
  0,
  'Étape 13 : le balayage est idempotent après clôture'
);

select * from finish();
rollback;
