import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const cities = JSON.parse(await readFile(resolve(root, "content/geography/cities.json"), "utf8"));
const migrationPath = process.argv[2]
  ? resolve(root, process.argv[2])
  : resolve(root, "supabase/migrations/20260909185440_geography_pack_and_rpc.sql");
const packId = "b7e7e1e2-6a65-4fd6-a4c7-9b80a9f7c001";

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function stableUuid(value) {
  const bytes = createHash("sha256").update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const counts = Object.groupBy(cities, (city) => city.difficulty);
const manifest = {
  source: "https://geo.api.gouv.fr/",
  mapSource: "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson",
  mapLicense: "Licence Ouverte / Etalab",
  populationYear: 2023,
  counts: Object.fromEntries(Object.entries(counts).map(([key, values]) => [key, values.length])),
  checksum: createHash("sha256").update(JSON.stringify(cities)).digest("hex"),
};

const itemValues = cities.map((city) => {
  const itemId = stableUuid(`tibo.fun:geography:v1:${city.inseeCode}`);
  return `  (${sqlString(itemId)}, ${sqlString(packId)}, ${sqlString(city.inseeCode)}, ${sqlString(city.difficulty)}, ${city.difficulty === "easy" ? 1 : city.difficulty === "medium" ? 2 : 3}, ${sqlJson(city)})`;
}).join(",\n");

const rpcSql = String.raw`
-- Server-only RPCs. The application sends actor IDs derived from a verified
-- Auth session; clients cannot execute these functions.

-- Realtime is an invalidation channel only. The payload intentionally contains
-- no projection data; clients must re-read through the authenticated API.
drop policy if exists user_broadcast_receive on realtime.messages;
create policy user_broadcast_receive
on realtime.messages
for select
to authenticated
using (
  realtime.topic() = 'user:' || (select auth.uid())::text
  and private = true
  and extension = 'broadcast'
  and topic = 'user:' || (select auth.uid())::text
);

create or replace function private.broadcast_room_view_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('id', new.room_id, 'version', new.version),
    'room.updated',
    'user:' || new.viewer_id::text,
    true
  );
  return new;
end;
$$;

create or replace function private.broadcast_match_view_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('id', new.match_id, 'version', new.version),
    'match.updated',
    'user:' || new.viewer_id::text,
    true
  );
  return new;
end;
$$;

create or replace function private.broadcast_history_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('id', new.match_id, 'version', 1),
    'history.updated',
    'user:' || new.viewer_id::text,
    true
  );
  return new;
end;
$$;

drop trigger if exists room_views_broadcast_update on public.room_views;
create trigger room_views_broadcast_update
after insert or update on public.room_views
for each row execute function private.broadcast_room_view_update();

drop trigger if exists match_views_broadcast_update on public.match_views;
create trigger match_views_broadcast_update
after insert or update on public.match_views
for each row execute function private.broadcast_match_view_update();

drop trigger if exists history_entries_broadcast_update on public.history_entries;
create trigger history_entries_broadcast_update
after insert or update on public.history_entries
for each row execute function private.broadcast_history_update();

create or replace function private.refresh_room_views(p_room_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room private.rooms%rowtype;
  v_payload jsonb;
  v_member record;
begin
  select * into v_room from private.rooms where id = p_room_id;
  if not found then return; end if;
  select jsonb_build_object(
    'kind', 'room',
    'roomId', v_room.id,
    'code', v_room.code,
    'gameSlug', v_room.game_slug,
    'config', v_room.config,
    'status', v_room.status,
    'version', v_room.version,
    'currentMatchId', v_room.current_match_id,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'pseudo', p.pseudo,
        'seat', rm.seat,
        'ready', rm.ready
      ) order by rm.seat)
      from private.room_members rm
      join public.profiles p on p.id = rm.user_id
      where rm.room_id = p_room_id
    ), '[]'::jsonb)
  ) into v_payload;
  for v_member in select user_id from private.room_members where room_id = p_room_id loop
    insert into public.room_views (room_id, viewer_id, version, payload, updated_at)
    values (p_room_id, v_member.user_id, v_room.version, v_payload, clock_timestamp())
    on conflict (room_id, viewer_id) do update set
      version = excluded.version,
      payload = excluded.payload,
      updated_at = excluded.updated_at;
  end loop;
end;
$$;

create or replace function private.claim_due_jobs(p_limit integer default 4)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_jobs jsonb;
begin
  with due as (
    select id
    from private.jobs
    where (
      (status = 'pending' and run_at <= clock_timestamp())
      or (status = 'running' and lease_until <= clock_timestamp())
    )
    and attempts < 5
    order by run_at, id
    for update skip locked
    limit least(greatest(coalesce(p_limit, 4), 1), 4)
  ), claimed as (
    update private.jobs j
    set status = 'running',
        attempts = j.attempts + 1,
        lease_token = extensions.gen_random_uuid(),
        lease_until = clock_timestamp() + interval '30 seconds',
        last_error_code = null
    from due
    where j.id = due.id
    returning j.id, j.match_id, j.kind, j.phase_id, j.payload, j.lease_token, j.run_at
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'jobId', id,
    'matchId', match_id,
    'kind', kind,
    'phaseId', phase_id,
    'payload', payload,
    'leaseToken', lease_token,
    'runAt', run_at
  ) order by run_at, id), '[]'::jsonb)
  into v_jobs
  from claimed;
  return v_jobs;
end;
$$;

create or replace function private.dispatch_due_jobs()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_worker_origin text;
  v_worker_secret text;
  v_jobs jsonb;
  v_request_id bigint;
begin
  select decrypted_secret into v_worker_origin
  from vault.decrypted_secrets
  where name = 'worker_origin'
  limit 1;
  select decrypted_secret into v_worker_secret
  from vault.decrypted_secrets
  where name = 'internal_job_secret'
  limit 1;
  if v_worker_origin is null or v_worker_secret is null then
    return jsonb_build_object('dispatched', false, 'reason', 'WORKER_CONFIGURATION_MISSING');
  end if;
  v_jobs := private.claim_due_jobs(4);
  if jsonb_array_length(v_jobs) = 0 then
    return jsonb_build_object('dispatched', false, 'reason', 'NO_DUE_JOBS');
  end if;
  select net.http_post(
    url := rtrim(v_worker_origin, '/') || '/api/internal/jobs/run',
    body := jsonb_build_object('jobs', v_jobs),
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-internal-job-secret', v_worker_secret
    ),
    timeout_milliseconds := 25000
  ) into v_request_id;
  return jsonb_build_object(
    'dispatched', true,
    'count', jsonb_array_length(v_jobs),
    'requestId', v_request_id
  );
exception
  when undefined_table or undefined_function then
    return jsonb_build_object('dispatched', false, 'reason', 'DISPATCH_EXTENSION_UNAVAILABLE');
end;
$$;

create or replace function public.server_get_actor(p_actor uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'pseudo', p.pseudo,
    'avatarPreset', p.avatar_preset,
    'avatarPath', p.avatar_path
  )
  from public.profiles p
  join private.site_members sm on sm.user_id = p.id
  where p.id = p_actor and sm.status = 'active';
$$;

create or replace function public.server_get_geography_content(p_difficulty text default null)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  with pack as (
    select id, version, manifest
    from private.content_packs
    where kind = 'geography' and slug = 'france-metropole' and status = 'published'
    order by version desc
    limit 1
  )
  select jsonb_build_object(
    'packId', pack.id,
    'packVersion', pack.version,
    'manifest', pack.manifest,
    'cities', coalesce((
      select jsonb_agg(ci.payload order by ci.logical_key)
      from private.content_items ci
      where ci.pack_id = pack.id
        and (p_difficulty is null or ci.category = p_difficulty)
    ), '[]'::jsonb)
  )
  from pack;
$$;

create or replace function public.server_get_room(p_actor uuid, p_room_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select rv.payload || jsonb_build_object('viewerId', p_actor)
  from public.room_views rv
  join private.room_members rm on rm.room_id = rv.room_id and rm.user_id = rv.viewer_id
  join private.site_members sm on sm.user_id = rv.viewer_id and sm.status = 'active'
  where rv.room_id = p_room_id and rv.viewer_id = p_actor;
$$;

create or replace function public.server_get_match(p_actor uuid, p_match_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'matchId', m.id,
    'roomId', m.room_id,
    'gameSlug', m.game_slug,
    'status', m.status,
    'mode', m.mode,
    'config', m.config,
    'rulesVersion', m.rules_version,
    'engineVersion', m.engine_version,
    'stateSchemaVersion', m.state_schema_version,
    'version', m.version,
    'phaseId', m.phase_id,
    'deadlineAt', m.deadline_at,
    'deadlineKind', m.deadline_kind,
    'startedAt', m.started_at,
    'players', (
      select jsonb_agg(jsonb_build_object(
        'id', mp.user_id,
        'seat', mp.seat,
        'pseudo', mp.pseudo_snapshot,
        'avatar', mp.avatar_snapshot,
        'lastSeenAt', mp.last_seen_at
      ) order by mp.seat)
      from private.match_players mp where mp.match_id = m.id
    ),
    'state', m.state,
    'view', mv.payload,
    'serverNow', clock_timestamp()
  )
  from private.matches m
  join private.match_players me on me.match_id = m.id and me.user_id = p_actor
  join private.site_members sm on sm.user_id = p_actor and sm.status = 'active'
  join public.match_views mv on mv.match_id = m.id and mv.viewer_id = p_actor
  where m.id = p_match_id;
$$;

create or replace function public.server_get_pair_history(
  p_actor uuid,
  p_opponent uuid,
  p_game text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'stats', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.game_slug)
      from private.pair_game_stats s
      where s.player_low = least(p_actor, p_opponent)
        and s.player_high = greatest(p_actor, p_opponent)
        and (p_game is null or s.game_slug = p_game)
    ), '[]'::jsonb),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'matchId', h.match_id,
        'opponentId', h.opponent_id,
        'gameSlug', h.game_slug,
        'startedAt', h.started_at,
        'endedAt', h.ended_at,
        'outcome', h.outcome,
        'score', h.score,
        'opponentScore', h.opponent_score,
        'sharedScore', h.shared_score,
        'payload', h.payload
      ) order by h.ended_at desc, h.match_id desc)
      from public.history_entries h
      where h.viewer_id = p_actor
        and h.opponent_id = p_opponent
        and (p_game is null or h.game_slug = p_game)
    ), '[]'::jsonb)
  )
  where exists (
    select 1 from private.site_members sm
    where sm.user_id = p_actor and sm.status = 'active'
  )
    and exists (
      select 1 from private.site_members sm
      where sm.user_id = p_opponent and sm.status = 'active'
    );
$$;

create or replace function public.server_room_heartbeat(p_actor uuid, p_room_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room private.rooms%rowtype;
  v_match_version bigint;
begin
  select * into v_room
  from private.rooms
  where id = p_room_id and status <> 'closed';
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if not exists (select 1 from private.room_members where room_id = p_room_id and user_id = p_actor) then
    raise exception 'NOT_A_ROOM_MEMBER';
  end if;
  update private.room_members
  set last_seen_at = clock_timestamp()
  where room_id = p_room_id and user_id = p_actor;
  select m.version into v_match_version
  from private.matches m
  where m.id = v_room.current_match_id;
  return jsonb_build_object(
    'roomId', p_room_id,
    'roomVersion', v_room.version,
    'matchVersion', v_match_version,
    'serverNow', clock_timestamp()
  );
end;
$$;

create or replace function public.server_match_heartbeat(p_actor uuid, p_match_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_match private.matches%rowtype;
  v_opponent_last_seen timestamptz;
  v_room_version bigint;
begin
  select * into v_match from private.matches where id = p_match_id and status = 'active';
  if not found then raise exception 'MATCH_NOT_ACTIVE'; end if;
  if not exists (select 1 from private.match_players where match_id = p_match_id and user_id = p_actor) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;
  update private.match_players
  set last_seen_at = clock_timestamp()
  where match_id = p_match_id and user_id = p_actor;
  select last_seen_at into v_opponent_last_seen
  from private.match_players
  where match_id = p_match_id and user_id <> p_actor;
  select version into v_room_version from private.rooms where id = v_match.room_id;
  return jsonb_build_object(
    'matchId', p_match_id,
    'roomVersion', v_room_version,
    'matchVersion', v_match.version,
    'opponentLastSeenAt', v_opponent_last_seen,
    'serverNow', clock_timestamp()
  );
end;
$$;

create or replace function public.server_get_job_context(
  p_job_id uuid,
  p_lease_token uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'jobId', j.id,
    'jobKind', j.kind,
    'jobPhaseId', j.phase_id,
    'jobPayload', j.payload,
    'jobAttempts', j.attempts,
    'matchId', m.id,
    'roomId', m.room_id,
    'gameSlug', m.game_slug,
    'status', m.status,
    'mode', m.mode,
    'config', m.config,
    'rulesVersion', m.rules_version,
    'engineVersion', m.engine_version,
    'stateSchemaVersion', m.state_schema_version,
    'version', m.version,
    'phaseId', m.phase_id,
    'deadlineAt', m.deadline_at,
    'deadlineKind', m.deadline_kind,
    'startedAt', m.started_at,
    'players', (
      select jsonb_agg(jsonb_build_object(
        'id', mp.user_id,
        'seat', mp.seat,
        'pseudo', mp.pseudo_snapshot,
        'avatar', mp.avatar_snapshot,
        'lastSeenAt', mp.last_seen_at
      ) order by mp.seat)
      from private.match_players mp where mp.match_id = m.id
    ),
    'state', m.state,
    'serverNow', clock_timestamp()
  )
  from private.jobs j
  join private.matches m on m.id = j.match_id
  where j.id = p_job_id
    and j.status = 'running'
    and j.lease_token = p_lease_token
    and j.lease_until > clock_timestamp();
$$;

create or replace function public.server_create_room(
  p_actor uuid,
  p_request_id uuid,
  p_game_slug text,
  p_config jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_game public.games%rowtype;
  v_room_id uuid;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
begin
  select response into v_existing from private.request_receipts
  where actor_id = p_actor and request_id = p_request_id and route = 'create_room';
  if v_existing is not null then return v_existing; end if;
  if not exists (select 1 from private.site_members where user_id = p_actor and status = 'active') then
    raise exception 'MEMBER_REQUIRED';
  end if;
  select * into v_game from public.games where slug = p_game_slug;
  if not found or v_game.availability = 'coming_soon' then raise exception 'GAME_NOT_READY'; end if;
  v_room_id := extensions.gen_random_uuid();
  loop
    v_bytes := extensions.gen_random_bytes(6);
    v_code := '';
    for v_byte_index in 0..5 loop
      v_code := v_code || substr(v_alphabet, 1 + (get_byte(v_bytes, v_byte_index) % length(v_alphabet)), 1);
    end loop;
    exit when not exists (select 1 from private.rooms where code = v_code);
  end loop;
  insert into private.rooms (id, code, host_id, game_slug, config, version, expires_at)
  values (v_room_id, v_code, p_actor, p_game_slug, coalesce(p_config, '{}'::jsonb), 1, clock_timestamp() + interval '24 hours');
  insert into private.room_members (room_id, user_id, seat, ready)
  values (v_room_id, p_actor, 0, false);
  perform private.refresh_room_views(v_room_id);
  v_existing := jsonb_build_object('roomId', v_room_id, 'code', v_code, 'version', 1);
  insert into private.request_receipts (actor_id, request_id, route, payload_hash, response)
  values (p_actor, p_request_id, 'create_room', encode(extensions.digest(convert_to(p_game_slug || coalesce(p_config, '{}'::jsonb)::text, 'UTF8'), 'sha256'), 'hex'), v_existing);
  return v_existing;
end;
$$;

create or replace function public.server_join_room(
  p_actor uuid,
  p_request_id uuid,
  p_code text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_room private.rooms%rowtype;
  v_seat smallint;
  v_version bigint;
begin
  select response into v_existing from private.request_receipts
  where actor_id = p_actor and request_id = p_request_id and route = 'join_room';
  if v_existing is not null then return v_existing; end if;
  if not exists (select 1 from private.site_members where user_id = p_actor and status = 'active') then raise exception 'MEMBER_REQUIRED'; end if;
  select * into v_room from private.rooms where code = upper(trim(p_code)) for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.status <> 'waiting' or v_room.expires_at <= clock_timestamp() then raise exception 'ROOM_CLOSED'; end if;
  if exists (select 1 from private.room_members where room_id = v_room.id and user_id = p_actor) then
    v_existing := jsonb_build_object('roomId', v_room.id, 'code', v_room.code, 'version', v_room.version);
  else
    if exists (select 1 from private.room_members where room_id = v_room.id and seat = 1) then raise exception 'ROOM_FULL'; end if;
    v_seat := 1;
    insert into private.room_members (room_id, user_id, seat, ready) values (v_room.id, p_actor, v_seat, false);
    update private.rooms set version = version + 1, expires_at = clock_timestamp() + interval '24 hours' where id = v_room.id returning version into v_version;
    perform private.refresh_room_views(v_room.id);
    v_existing := jsonb_build_object('roomId', v_room.id, 'code', v_room.code, 'version', v_version);
  end if;
  insert into private.request_receipts (actor_id, request_id, route, payload_hash, response)
  values (p_actor, p_request_id, 'join_room', encode(extensions.digest(convert_to(upper(trim(p_code)), 'UTF8'), 'sha256'), 'hex'), v_existing);
  return v_existing;
end;
$$;

create or replace function public.server_set_room_ready(
  p_actor uuid,
  p_command_id uuid,
  p_room_id uuid,
  p_expected_version bigint,
  p_ready boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_room private.rooms%rowtype;
  v_version bigint;
begin
  select response into v_existing from private.room_command_receipts where room_id = p_room_id and command_id = p_command_id;
  if v_existing is not null then return v_existing; end if;
  select * into v_room from private.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if not exists (select 1 from private.room_members where room_id = p_room_id and user_id = p_actor) then raise exception 'NOT_A_ROOM_MEMBER'; end if;
  if v_room.status <> 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;
  if v_room.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  update private.room_members set ready = p_ready, last_seen_at = clock_timestamp() where room_id = p_room_id and user_id = p_actor;
  update private.rooms set version = version + 1 where id = p_room_id returning version into v_version;
  perform private.refresh_room_views(p_room_id);
  v_existing := jsonb_build_object('roomId', p_room_id, 'version', v_version, 'ready', p_ready);
  insert into private.room_command_receipts (room_id, command_id, actor_id, action_type, payload_hash, committed_version, response)
  values (p_room_id, p_command_id, p_actor, 'SET_READY', encode(extensions.digest(convert_to(p_ready::text, 'UTF8'), 'sha256'), 'hex'), v_version, v_existing);
  return v_existing;
end;
$$;

create or replace function public.server_finish_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_status text,
  p_error_code text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job private.jobs%rowtype;
begin
  if p_status not in ('done', 'cancelled') then raise exception 'INVALID_JOB_STATUS'; end if;
  select * into v_job from private.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if v_job.status in ('done', 'cancelled', 'failed') then
    return jsonb_build_object('jobId', v_job.id, 'status', v_job.status);
  end if;
  if v_job.status <> 'running' or v_job.lease_token is distinct from p_lease_token or v_job.lease_until <= clock_timestamp() then
    raise exception 'JOB_LEASE_INVALID';
  end if;
  update private.jobs
  set status = p_status,
      last_error_code = p_error_code,
      completed_at = clock_timestamp(),
      lease_token = null,
      lease_until = null
  where id = p_job_id;
  if p_status = 'done' and v_job.kind = 'check_absence' and v_job.match_id is not null
     and exists (select 1 from private.matches m where m.id = v_job.match_id and m.status = 'active') then
    insert into private.jobs (match_id, kind, phase_id, dedupe_key, payload, run_at, status)
    values (
      v_job.match_id,
      'check_absence',
      null,
      v_job.id::text || ':next',
      jsonb_build_object('matchId', v_job.match_id, 'kind', 'check_absence'),
      clock_timestamp() + interval '30 seconds',
      'pending'
    )
    on conflict (dedupe_key) do nothing;
  end if;
  return jsonb_build_object('jobId', p_job_id, 'status', p_status);
end;
$$;

create or replace function public.server_fail_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_error_code text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job private.jobs%rowtype;
  v_next_status text;
  v_next_run_at timestamptz;
begin
  select * into v_job from private.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if v_job.status in ('done', 'cancelled', 'failed') then
    return jsonb_build_object('jobId', v_job.id, 'status', v_job.status, 'terminal', true);
  end if;
  if v_job.status <> 'running' or v_job.lease_token is distinct from p_lease_token or v_job.lease_until <= clock_timestamp() then
    raise exception 'JOB_LEASE_INVALID';
  end if;
  if v_job.attempts >= 5 then
    v_next_status := 'failed';
    v_next_run_at := v_job.run_at;
  else
    v_next_status := 'pending';
    v_next_run_at := clock_timestamp() + case v_job.attempts
      when 1 then interval '1 second'
      when 2 then interval '2 seconds'
      when 3 then interval '4 seconds'
      else interval '8 seconds'
    end;
  end if;
  update private.jobs
  set status = v_next_status,
      run_at = v_next_run_at,
      last_error_code = left(coalesce(p_error_code, 'WORKER_ERROR'), 120),
      completed_at = case when v_next_status = 'failed' then clock_timestamp() else null end,
      lease_token = null,
      lease_until = null
  where id = p_job_id;
  return jsonb_build_object('jobId', p_job_id, 'status', v_next_status, 'terminal', v_next_status = 'failed');
end;
$$;

create or replace function public.server_start_match(
  p_actor uuid,
  p_command_id uuid,
  p_room_id uuid,
  p_expected_version bigint,
  p_match_id uuid,
  p_mode text,
  p_config jsonb,
  p_state jsonb,
  p_phase_id uuid,
  p_deadline_at timestamptz,
  p_deadline_kind text,
  p_views jsonb,
  p_jobs jsonb,
  p_content_manifest jsonb,
  p_rules_version text,
  p_engine_version text,
  p_state_schema_version integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_room private.rooms%rowtype;
  v_game public.games%rowtype;
  v_match_id uuid := p_match_id;
  v_version bigint;
  v_item jsonb;
  v_job jsonb;
begin
  select response into v_existing from private.room_command_receipts where room_id = p_room_id and command_id = p_command_id;
  if v_existing is not null then return v_existing; end if;
  select * into v_room from private.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.host_id <> p_actor then raise exception 'HOST_REQUIRED'; end if;
  if v_room.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if v_room.status <> 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;
  select * into v_game from public.games where slug = v_room.game_slug;
  if v_game.availability = 'coming_soon' then raise exception 'GAME_NOT_READY'; end if;
  if (select count(*) from private.room_members where room_id = p_room_id) <> 2 then raise exception 'TWO_PLAYERS_REQUIRED'; end if;
  if exists (select 1 from private.room_members where room_id = p_room_id and not ready) then raise exception 'PLAYERS_NOT_READY'; end if;
  if p_mode not in ('random', 'challenge') then raise exception 'INVALID_MODE'; end if;
  if v_match_id is null then raise exception 'INVALID_MATCH_ID'; end if;
  insert into private.matches (
    id, room_id, game_slug, mode, config, rules_version, engine_version,
    state_schema_version, content_manifest, state, version, phase_id,
    deadline_at, deadline_kind
  ) values (
    v_match_id, p_room_id, v_room.game_slug, p_mode, p_config, p_rules_version, p_engine_version,
    p_state_schema_version, p_content_manifest, p_state, 0, p_phase_id, p_deadline_at, p_deadline_kind
  );
  insert into private.match_players (match_id, user_id, seat, pseudo_snapshot, avatar_snapshot)
  select v_match_id, rm.user_id, rm.seat, p.pseudo, jsonb_build_object('preset', p.avatar_preset, 'path', p.avatar_path)
  from private.room_members rm join public.profiles p on p.id = rm.user_id where rm.room_id = p_room_id order by rm.seat;
  for v_item in select * from jsonb_array_elements(p_views) loop
    insert into public.match_views (match_id, viewer_id, version, payload)
    values (v_match_id, (v_item->>'viewerId')::uuid, 0, v_item->'payload');
  end loop;
  for v_job in select * from jsonb_array_elements(coalesce(p_jobs, '[]'::jsonb)) loop
    insert into private.jobs (match_id, kind, phase_id, dedupe_key, payload, run_at, status)
    values (v_match_id, v_job->>'kind', nullif(v_job->>'phaseId', '')::uuid, v_job->>'dedupeKey', coalesce(v_job->'payload', '{}'::jsonb), (v_job->>'runAt')::timestamptz, 'pending')
    on conflict (dedupe_key) do nothing;
  end loop;
  insert into private.jobs (match_id, kind, phase_id, dedupe_key, payload, run_at, status)
  values (
    v_match_id,
    'check_absence',
    null,
    v_match_id::text || ':absence:0',
    jsonb_build_object('matchId', v_match_id, 'kind', 'check_absence'),
    clock_timestamp() + interval '30 seconds',
    'pending'
  )
  on conflict (dedupe_key) do nothing;
  update private.rooms set status = 'playing', current_match_id = v_match_id, version = version + 1 where id = p_room_id returning version into v_version;
  perform private.refresh_room_views(p_room_id);
  v_existing := jsonb_build_object('matchId', v_match_id, 'roomId', p_room_id, 'version', 0);
  insert into private.room_command_receipts (room_id, command_id, actor_id, action_type, payload_hash, committed_version, response)
  values (p_room_id, p_command_id, p_actor, 'START_MATCH', encode(extensions.digest(convert_to(p_state::text, 'UTF8'), 'sha256'), 'hex'), v_version, v_existing);
  return v_existing;
end;
$$;

create or replace function public.server_commit_match(p_envelope jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_match private.matches%rowtype;
  v_current_job private.jobs%rowtype;
  v_match_id uuid := (p_envelope->>'matchId')::uuid;
  v_actor_id uuid := nullif(p_envelope->>'actorId', '')::uuid;
  v_command_id uuid := (p_envelope->>'commandId')::uuid;
  v_job_id uuid := nullif(p_envelope->>'jobId', '')::uuid;
  v_lease_token uuid := nullif(p_envelope->>'leaseToken', '')::uuid;
  v_source text := coalesce(p_envelope->>'source', 'player');
  v_expected_version bigint := (p_envelope->>'expectedVersion')::bigint;
  v_new_version bigint;
  v_existing jsonb;
  v_next jsonb := p_envelope->'next';
  v_state jsonb := v_next->'state';
  v_result jsonb := p_envelope->'result';
  v_event jsonb := p_envelope->'event';
  v_view_item jsonb;
  v_job jsonb;
  v_record jsonb;
  v_result_player jsonb;
  v_match_player record;
  v_user_id uuid;
  v_opponent uuid;
  v_outcome text;
  v_score numeric;
  v_metrics jsonb;
  v_winner uuid;
  v_ended_at timestamptz;
  v_actor_view jsonb;
begin
  if v_source = 'job' then
    select response into v_existing from private.job_receipts where job_id = v_job_id;
    if v_existing is not null then
      if v_existing->>'commandHash' <> p_envelope->>'commandHash' then raise exception 'COMMAND_ID_REUSED'; end if;
      return v_existing;
    end if;
  else
    select response into v_existing from private.command_receipts
    where match_id = v_match_id and command_id = v_command_id;
    if v_existing is not null then
      if v_existing->>'commandHash' <> p_envelope->>'commandHash' then raise exception 'COMMAND_ID_REUSED'; end if;
      return v_existing;
    end if;
  end if;
  select * into v_match from private.matches where id = v_match_id for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  if v_match.status <> 'active' then raise exception 'MATCH_NOT_ACTIVE'; end if;
  if v_match.version <> v_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if v_match.phase_id <> (p_envelope->>'previousPhaseId')::uuid then raise exception 'PHASE_CONFLICT'; end if;
  if v_source = 'player' then
    if v_actor_id is null or not exists (select 1 from private.match_players where match_id = v_match_id and user_id = v_actor_id) then raise exception 'NOT_A_PARTICIPANT'; end if;
    if v_match.deadline_at is not null and v_match.deadline_at <= clock_timestamp() then raise exception 'DEADLINE_EXPIRED'; end if;
    update private.match_players set last_seen_at = clock_timestamp()
    where match_id = v_match_id and user_id = v_actor_id;
    if coalesce(v_event->>'type', '') = 'FORFEIT_CLAIMED' and not exists (
      select 1
      from private.match_players
      where match_id = v_match_id
        and user_id <> v_actor_id
        and last_seen_at <= clock_timestamp() - interval '90 seconds'
    ) then
      raise exception 'FORFEIT_NOT_AVAILABLE';
    end if;
  elsif v_source = 'job' then
    if v_job_id is null or v_lease_token is null then raise exception 'JOB_LEASE_INVALID'; end if;
    select * into v_current_job from private.jobs where id = v_job_id for update;
    if not found or v_current_job.match_id is distinct from v_match_id or v_current_job.status <> 'running' or v_current_job.lease_token is distinct from v_lease_token or v_current_job.lease_until <= clock_timestamp() then
      raise exception 'JOB_LEASE_INVALID';
    end if;
    if v_current_job.phase_id is not null and v_current_job.phase_id <> v_match.phase_id then raise exception 'STALE_JOB'; end if;
    if v_current_job.kind = 'check_absence' then
      if not (
        (select count(*) from private.match_players where match_id = v_match_id and last_seen_at <= clock_timestamp() - interval '120 seconds') = 2
        or (select count(*) from private.match_players where match_id = v_match_id and last_seen_at <= clock_timestamp() - interval '180 seconds') >= 1
      ) then
        raise exception 'JOB_NOT_DUE';
      end if;
    elsif v_match.deadline_at is null or v_match.deadline_at > clock_timestamp() then
      raise exception 'JOB_NOT_DUE';
    end if;
  else
    raise exception 'INVALID_COMMIT_SOURCE';
  end if;
  v_new_version := v_match.version + 1;
  if jsonb_array_length(p_envelope->'views') <> 2 then raise exception 'INVALID_VIEWS'; end if;
  for v_view_item in select * from jsonb_array_elements(p_envelope->'views') loop
    if not exists (select 1 from private.match_players where match_id = v_match_id and user_id = (v_view_item->>'viewerId')::uuid) then raise exception 'INVALID_VIEWER'; end if;
    if (v_view_item->>'viewerId')::uuid = v_actor_id then v_actor_view := v_view_item->'payload'; end if;
  end loop;
  if v_actor_view is null and v_source = 'player' then raise exception 'MISSING_ACTOR_VIEW'; end if;
  update private.matches set
    state = v_state,
    version = v_new_version,
    phase_id = (v_next->>'phaseId')::uuid,
    deadline_at = nullif(v_next->>'deadlineAt', '')::timestamptz,
    deadline_kind = nullif(v_next->>'deadlineKind', ''),
    status = case when v_result is null or jsonb_typeof(v_result) = 'null' then 'active' else case when v_result->>'outcome' = 'abandoned' then 'abandoned' else 'completed' end end,
    ended_at = case when v_result is null or jsonb_typeof(v_result) = 'null' then null else clock_timestamp() end,
    end_reason = case when v_result is null or jsonb_typeof(v_result) = 'null' then null else v_result->>'reason' end
  where id = v_match_id;
  update private.jobs set status = 'cancelled', completed_at = clock_timestamp(), lease_token = null, lease_until = null
  where match_id = v_match_id and status in ('pending', 'running') and (v_source <> 'job' or id <> v_job_id);
  for v_job in select * from jsonb_array_elements(coalesce(p_envelope->'jobsToUpsert', '[]'::jsonb)) loop
    insert into private.jobs (match_id, kind, phase_id, dedupe_key, payload, run_at, status)
    values (v_match_id, v_job->>'kind', nullif(v_job->>'phaseId', '')::uuid, v_job->>'dedupeKey', coalesce(v_job->'payload', '{}'::jsonb), (v_job->>'runAt')::timestamptz, 'pending')
    on conflict (dedupe_key) do nothing;
  end loop;
  if v_result is null or jsonb_typeof(v_result) = 'null' then
    insert into private.jobs (match_id, kind, phase_id, dedupe_key, payload, run_at, status)
    values (
      v_match_id,
      'check_absence',
      null,
      v_match_id::text || ':absence:' || v_new_version::text,
      jsonb_build_object('matchId', v_match_id, 'kind', 'check_absence'),
      clock_timestamp() + interval '30 seconds',
      'pending'
    )
    on conflict (dedupe_key) do nothing;
  end if;
  for v_record in select * from jsonb_array_elements(coalesce(p_envelope->'roundRecords', '[]'::jsonb)) loop
    insert into private.round_results (match_id, round_no, summary, completed_at)
    values (v_match_id, (v_record->>'roundNo')::integer, v_record->'summary', (v_record->>'completedAt')::timestamptz)
    on conflict (match_id, round_no) do nothing;
  end loop;
  insert into private.match_events (match_id, version, event_type, actor_id, payload)
  values (v_match_id, v_new_version, coalesce(v_event->>'type', 'TRANSITION'), v_actor_id, coalesce(v_event->'payload', '{}'::jsonb));
  for v_view_item in select * from jsonb_array_elements(p_envelope->'views') loop
    insert into public.match_views (match_id, viewer_id, version, payload, updated_at)
    values (v_match_id, (v_view_item->>'viewerId')::uuid, v_new_version, v_view_item->'payload', clock_timestamp())
    on conflict (match_id, viewer_id) do update set version = excluded.version, payload = excluded.payload, updated_at = excluded.updated_at;
  end loop;
  if v_result is not null and jsonb_typeof(v_result) <> 'null' then
    v_winner := nullif(v_result->>'winnerId', '')::uuid;
    v_ended_at := clock_timestamp();
    insert into private.match_results (match_id, kind, outcome, winner_id, shared_score, summary, reason, completed_at)
    values (v_match_id, v_result->>'kind', v_result->>'outcome', v_winner, nullif(v_result->>'sharedScore', '')::numeric, coalesce(v_result->'summary', '{}'::jsonb), v_result->>'reason', v_ended_at)
    on conflict (match_id) do nothing;
    for v_result_player in select * from jsonb_array_elements(v_result->'players') loop
      v_user_id := (v_result_player->>'userId')::uuid;
      v_score := nullif(v_result_player->>'score', '')::numeric;
      v_metrics := coalesce(v_result_player->'metrics', '{}'::jsonb);
      v_outcome := case
        when v_result->>'outcome' = 'abandoned' then 'abandoned'
        when v_result->>'outcome' = 'draw' then 'draw'
        when v_winner = v_user_id then 'win'
        else 'loss'
      end;
      insert into private.player_results (match_id, user_id, outcome, score, metrics)
      values (v_match_id, v_user_id, v_outcome, v_score, v_metrics)
      on conflict (match_id, user_id) do nothing;
      insert into public.player_game_stats (user_id, game_slug, played, wins, losses, draws, cooperative, abandoned, metrics)
      values (
        v_user_id, v_match.game_slug,
        case when v_outcome in ('win', 'loss', 'draw', 'cooperative') then 1 else 0 end,
        case when v_outcome = 'win' then 1 else 0 end,
        case when v_outcome = 'loss' then 1 else 0 end,
        case when v_outcome = 'draw' then 1 else 0 end,
        case when v_outcome = 'cooperative' then 1 else 0 end,
        case when v_outcome = 'abandoned' then 1 else 0 end,
        v_metrics
      )
      on conflict (user_id, game_slug) do update set
        played = public.player_game_stats.played + excluded.played,
        wins = public.player_game_stats.wins + excluded.wins,
        losses = public.player_game_stats.losses + excluded.losses,
        draws = public.player_game_stats.draws + excluded.draws,
        cooperative = public.player_game_stats.cooperative + excluded.cooperative,
        abandoned = public.player_game_stats.abandoned + excluded.abandoned,
        metrics = public.player_game_stats.metrics || excluded.metrics,
        updated_at = clock_timestamp();
    end loop;
    for v_match_player in select * from private.match_players where match_id = v_match_id loop
      select user_id into v_opponent from private.match_players where match_id = v_match_id and user_id <> v_match_player.user_id;
      v_score := nullif((v_result->'players'->v_match_player.seat->>'score'), '')::numeric;
      insert into public.history_entries (viewer_id, match_id, opponent_id, game_slug, started_at, ended_at, outcome, score, opponent_score, shared_score, payload)
      values (
        v_match_player.user_id, v_match_id, v_opponent, v_match.game_slug, v_match.started_at, v_ended_at,
        case when v_result->>'outcome' = 'abandoned' then 'abandoned' when v_result->>'outcome' = 'draw' then 'draw' when v_winner = v_match_player.user_id then 'win' else 'loss' end,
        v_score,
        nullif((v_result->'players'->(1-v_match_player.seat)->>'score'), '')::numeric,
        nullif(v_result->>'sharedScore', '')::numeric,
        jsonb_build_object(
          'summary', coalesce(v_result->'summary', '{}'::jsonb),
          'reason', v_result->>'reason',
          'players', coalesce((
            select jsonb_agg(jsonb_build_object(
              'userId', mp.user_id,
              'pseudo', mp.pseudo_snapshot,
              'score', nullif((v_result->'players'->mp.seat->>'score'), '')::numeric,
              'metrics', coalesce(v_result->'players'->mp.seat->'metrics', '{}'::jsonb)
            ) order by mp.seat)
            from private.match_players mp
            where mp.match_id = v_match_id
          ), '[]'::jsonb)
        )
      ) on conflict (viewer_id, match_id) do nothing;
    end loop;
    if v_result->>'kind' = 'competitive' then
      insert into private.pair_game_stats (player_low, player_high, game_slug, played, low_wins, high_wins, draws, cooperative, abandoned, metrics)
      select least(mp0.user_id, mp1.user_id), greatest(mp0.user_id, mp1.user_id), v_match.game_slug,
        case when v_result->>'outcome' in ('win','draw') then 1 else 0 end,
        case when v_result->>'outcome' = 'win' and v_winner = least(mp0.user_id, mp1.user_id) then 1 else 0 end,
        case when v_result->>'outcome' = 'win' and v_winner = greatest(mp0.user_id, mp1.user_id) then 1 else 0 end,
        case when v_result->>'outcome' = 'draw' then 1 else 0 end,
        0,
        case when v_result->>'outcome' = 'abandoned' then 1 else 0 end,
        coalesce(v_result->'summary', '{}'::jsonb)
      from (select user_id from private.match_players where match_id = v_match_id and seat = 0) mp0,
           (select user_id from private.match_players where match_id = v_match_id and seat = 1) mp1
      on conflict (player_low, player_high, game_slug) do update set
        played = private.pair_game_stats.played + excluded.played,
        low_wins = private.pair_game_stats.low_wins + excluded.low_wins,
        high_wins = private.pair_game_stats.high_wins + excluded.high_wins,
        draws = private.pair_game_stats.draws + excluded.draws,
        abandoned = private.pair_game_stats.abandoned + excluded.abandoned,
        metrics = private.pair_game_stats.metrics || excluded.metrics,
        updated_at = clock_timestamp();
    end if;
    update private.room_members
    set ready = false
    where room_id = v_match.room_id;
    update private.rooms
    set status = 'waiting', current_match_id = null, version = version + 1
    where id = v_match.room_id;
    perform private.refresh_room_views(v_match.room_id);
  end if;
  v_existing := jsonb_build_object(
    'matchId', v_match_id,
    'version', v_new_version,
    'commandHash', p_envelope->>'commandHash',
    'view', v_actor_view
  );
  if v_source = 'job' then
    update private.jobs
    set status = 'done', completed_at = clock_timestamp(), lease_token = null, lease_until = null
    where id = v_job_id;
    v_existing := v_existing || jsonb_build_object('jobId', v_job_id);
    insert into private.job_receipts (job_id, payload_hash, committed_version, response)
    values (v_job_id, p_envelope->>'commandHash', v_new_version, v_existing);
  else
    insert into private.command_receipts (match_id, command_id, actor_id, action_type, payload_hash, committed_version, response)
    values (v_match_id, v_command_id, v_actor_id, coalesce(v_event->>'type', 'TRANSITION'), p_envelope->>'commandHash', v_new_version, v_existing);
  end if;
  return v_existing;
end;
$$;

revoke all on function private.broadcast_room_view_update() from public, anon, authenticated;
revoke all on function private.broadcast_match_view_update() from public, anon, authenticated;
revoke all on function private.broadcast_history_update() from public, anon, authenticated;
revoke all on function private.refresh_room_views(uuid) from public, anon, authenticated;
revoke all on function private.claim_due_jobs(integer) from public, anon, authenticated;
revoke all on function private.dispatch_due_jobs() from public, anon, authenticated;
revoke all on function public.server_get_actor(uuid) from public, anon, authenticated;
revoke all on function public.server_get_geography_content(text) from public, anon, authenticated;
revoke all on function public.server_get_room(uuid, uuid) from public, anon, authenticated;
revoke all on function public.server_get_match(uuid, uuid) from public, anon, authenticated;
revoke all on function public.server_get_pair_history(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.server_room_heartbeat(uuid, uuid) from public, anon, authenticated;
revoke all on function public.server_match_heartbeat(uuid, uuid) from public, anon, authenticated;
revoke all on function public.server_get_job_context(uuid, uuid) from public, anon, authenticated;
revoke all on function public.server_create_room(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.server_join_room(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.server_set_room_ready(uuid, uuid, uuid, bigint, boolean) from public, anon, authenticated;
revoke all on function public.server_finish_job(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.server_fail_job(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.server_start_match(uuid, uuid, uuid, bigint, uuid, text, jsonb, jsonb, uuid, timestamptz, text, jsonb, jsonb, jsonb, text, text, integer) from public, anon, authenticated;
revoke all on function public.server_commit_match(jsonb) from public, anon, authenticated;
grant execute on function private.claim_due_jobs(integer) to service_role;
grant execute on function private.dispatch_due_jobs() to service_role;
grant execute on function public.server_get_actor(uuid) to service_role;
grant execute on function public.server_get_geography_content(text) to service_role;
grant execute on function public.server_get_room(uuid, uuid) to service_role;
grant execute on function public.server_get_match(uuid, uuid) to service_role;
grant execute on function public.server_get_pair_history(uuid, uuid, text) to service_role;
grant execute on function public.server_room_heartbeat(uuid, uuid) to service_role;
grant execute on function public.server_match_heartbeat(uuid, uuid) to service_role;
grant execute on function public.server_get_job_context(uuid, uuid) to service_role;
grant execute on function public.server_create_room(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.server_join_room(uuid, uuid, text) to service_role;
grant execute on function public.server_set_room_ready(uuid, uuid, uuid, bigint, boolean) to service_role;
grant execute on function public.server_finish_job(uuid, uuid, text, text) to service_role;
grant execute on function public.server_fail_job(uuid, uuid, text) to service_role;
grant execute on function public.server_start_match(uuid, uuid, uuid, bigint, uuid, text, jsonb, jsonb, uuid, timestamptz, text, jsonb, jsonb, jsonb, text, text, integer) to service_role;
grant execute on function public.server_commit_match(jsonb) to service_role;
grant execute on function private.refresh_room_views(uuid) to service_role;
grant all on all tables in schema private to service_role;
grant all on all sequences in schema private to service_role;
grant select on public.profiles, public.games to service_role;
grant select, insert, update, delete on public.room_views, public.match_views, public.history_entries, public.player_game_stats to service_role;
`;

const sql = `-- tibo.fun — versioned Géographie content pack and trusted server RPCs

insert into private.content_packs (id, kind, slug, version, status, manifest, published_at)
values (${sqlString(packId)}, 'geography', 'france-metropole', 1, 'published', ${sqlJson(manifest)}, now())
on conflict (kind, slug, version) do nothing;

insert into private.content_items (id, pack_id, logical_key, category, difficulty, payload)
values
${itemValues}
on conflict (pack_id, logical_key) do nothing;

update public.games
set availability = 'ready', rules_version = 'geographie-1'
where slug = 'geographie';
${rpcSql}
`;

await writeFile(migrationPath, sql, "utf8");
console.log(`Migration Géographie écrite : ${migrationPath} (${cities.length} items)`);
