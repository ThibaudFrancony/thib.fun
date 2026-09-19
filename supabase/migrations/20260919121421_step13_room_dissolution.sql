-- tibo.fun — Étape 13 : dissolution d'un salon sans partie ni présence depuis 1 h.
--
-- Décision produit du 19/09/2026 : un salon en attente est dissous quand, depuis
-- une heure, aucune partie n'a été lancée ET plus aucun joueur n'est présent.
-- `rooms.updated_at` (trigger `rooms_touch_updated_at`) trace les mutations
-- significatives : création, join, ready, configuration, début de partie et fin
-- de partie (`record_match_result` repose `status = 'waiting'`). Le heartbeat du
-- salon met à jour `room_members.last_seen_at` sans toucher `rooms.updated_at`.
-- Le plus récent des deux constitue donc la dernière activité ; s'il date de
-- plus d'une heure, le salon est fermé. Une partie active (`status = 'playing'`)
-- n'est jamais dissoute par cette règle. La limite dure de 24 h (`expires_at`)
-- reste un plafond.
--
-- Le balayage est idempotent : un salon fermé passe `closed`, `version + 1`, et
-- `refresh_room_views` diffuse la projection puis l'invalidation Realtime aux
-- membres. Le heartbeat applique la même règle à la volée, filet si le cron est
-- indisponible. Aucune migration déjà appliquée n'est réécrite.

create or replace function private.dissolve_inactive_rooms(p_limit integer default 50)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room private.rooms%rowtype;
  v_now timestamptz := clock_timestamp();
  v_count integer := 0;
begin
  for v_room in
    select r.*
    from private.rooms r
    where r.status = 'waiting'
      and greatest(
        r.updated_at,
        coalesce(
          (select max(rm.last_seen_at) from private.room_members rm where rm.room_id = r.id),
          r.updated_at
        )
      ) <= v_now - interval '1 hour'
    order by r.updated_at
    for update skip locked
    limit p_limit
  loop
    update private.rooms
    set status = 'closed', version = version + 1
    where id = v_room.id;
    perform private.refresh_room_views(v_room.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function private.dissolve_inactive_rooms(integer) from public, anon, authenticated;

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
  select * into v_room from private.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if not exists (select 1 from private.room_members where room_id = p_room_id and user_id = p_actor) then
    raise exception 'NOT_A_ROOM_MEMBER';
  end if;
  if v_room.status = 'closed' then raise exception 'ROOM_CLOSED'; end if;

  if v_room.status = 'waiting' and (
    v_room.expires_at <= clock_timestamp()
    or greatest(
      v_room.updated_at,
      coalesce(
        (select max(rm.last_seen_at) from private.room_members rm where rm.room_id = v_room.id),
        v_room.updated_at
      )
    ) <= clock_timestamp() - interval '1 hour'
  ) then
    update private.rooms set status = 'closed', version = version + 1 where id = p_room_id returning * into v_room;
    perform private.refresh_room_views(p_room_id);
  end if;
  update private.room_members set last_seen_at = clock_timestamp() where room_id = p_room_id and user_id = p_actor;
  select m.version into v_match_version from private.matches m where m.id = v_room.current_match_id;
  return jsonb_build_object(
    'roomId', p_room_id,
    'roomVersion', v_room.version,
    'matchVersion', v_match_version,
    'status', v_room.status,
    'serverNow', clock_timestamp()
  );
end;
$$;

do $migration$
declare
  v_job record;
begin
  for v_job in
    select jobid from cron.job where jobname = 'tibo-fun-dissolve-inactive-rooms'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
  perform cron.schedule(
    'tibo-fun-dissolve-inactive-rooms',
    '30 seconds',
    $job$select private.dissolve_inactive_rooms();$job$
  );
end;
$migration$;
