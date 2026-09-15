begin;

select plan(22);

select ok(
  exists (
    select 1 from pg_proc
    where oid = 'public.server_change_room(uuid, uuid, uuid, bigint, jsonb)'::regprocedure
  ),
  'Étape 8 : la RPC de gestion du salon existe'
);
select ok(
  not (select prosecdef from pg_proc where oid = 'public.server_change_room(uuid, uuid, uuid, bigint, jsonb)'::regprocedure),
  'Étape 8 : la RPC du salon reste SECURITY INVOKER'
);
select ok(
  has_function_privilege('service_role', 'public.server_change_room(uuid, uuid, uuid, bigint, jsonb)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.server_change_room(uuid, uuid, uuid, bigint, jsonb)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.server_change_room(uuid, uuid, uuid, bigint, jsonb)', 'EXECUTE'),
  'Étape 8 : seules les mutations serveur peuvent gérer le salon'
);
select ok(
  exists (select 1 from information_schema.columns where table_schema = 'private' and table_name = 'rooms' and column_name = 'host_id')
    and exists (select 1 from information_schema.columns where table_schema = 'private' and table_name = 'rooms' and column_name = 'expires_at'),
  'Étape 8 : le salon possède hôte et échéance côté serveur'
);
select ok(
  position('''hostId'', v_room.host_id' in pg_get_functiondef('private.refresh_room_views(uuid)'::regprocedure)) > 0
    and position('''expiresAt'', v_room.expires_at' in pg_get_functiondef('private.refresh_room_views(uuid)'::regprocedure)) > 0,
  'Projection salon : hôte et expiration sont projetés'
);
select ok(
  position('''hostId'', r.host_id' in pg_get_functiondef('public.server_get_room(uuid, uuid)'::regprocedure)) > 0
    and position('''expiresAt'', r.expires_at' in pg_get_functiondef('public.server_get_room(uuid, uuid)'::regprocedure)) > 0,
  'Lecture salon : hôte et expiration sont récupérés depuis la ligne courante'
);

select ok(
  position('v_room.version <> p_expected_version' in pg_get_functiondef('public.server_change_room(uuid, uuid, uuid, bigint, jsonb)'::regprocedure)) > 0,
  'Concurrence salon : une action obsolète est refusée'
);
select ok(
  position('from private.room_command_receipts' in pg_get_functiondef('public.server_change_room(uuid, uuid, uuid, bigint, jsonb)'::regprocedure)) > 0
    and position('''COMMAND_ID_REUSED''' in pg_get_functiondef('public.server_change_room(uuid, uuid, uuid, bigint, jsonb)'::regprocedure)) > 0,
  'Idempotence salon : le reçu vérifie acteur, type et hash'
);
select ok(
  position('v_action_type = ''LEAVE''' in pg_get_functiondef('public.server_change_room(uuid, uuid, uuid, bigint, jsonb)'::regprocedure)) > 0
    and position('delete from private.room_members' in lower(pg_get_functiondef('public.server_change_room(uuid, uuid, uuid, bigint, jsonb)'::regprocedure))) > 0,
  'Sortie salon : LEAVE retire réellement le membre'
);
select ok(
  position('v_room.host_id = p_actor' in pg_get_functiondef('public.server_change_room(uuid, uuid, uuid, bigint, jsonb)'::regprocedure)) > 0
    and position('set host_id = v_new_host' in lower(pg_get_functiondef('public.server_change_room(uuid, uuid, uuid, bigint, jsonb)'::regprocedure))) > 0,
  'Sortie salon : l''hôte est transféré au membre restant'
);
select ok(
  position('p_action->''config''' in pg_get_functiondef('public.server_change_room(uuid, uuid, uuid, bigint, jsonb)'::regprocedure)) > 0
    and position('set ready = false' in lower(pg_get_functiondef('public.server_change_room(uuid, uuid, uuid, bigint, jsonb)'::regprocedure))) > 0,
  'Configuration salon : le serveur remplace le jeu et invalide les ready'
);
select ok(
  position('targetuserid' in lower(pg_get_functiondef('public.server_change_room(uuid, uuid, uuid, bigint, jsonb)'::regprocedure))) > 0
    and position('room_target_not_member' in lower(pg_get_functiondef('public.server_change_room(uuid, uuid, uuid, bigint, jsonb)'::regprocedure))) > 0,
  'Hôte salon : le transfert cible un participant réel'
);
select ok(
  position('v_expired := v_room.expires_at <= clock_timestamp()' in pg_get_functiondef('public.server_change_room(uuid, uuid, uuid, bigint, jsonb)'::regprocedure)) > 0
    and position('''ROOM_EXPIRED''' in pg_get_functiondef('public.server_change_room(uuid, uuid, uuid, bigint, jsonb)'::regprocedure)) > 0,
  'Expiration salon : les changements sont refusés après échéance'
);
select ok(
  position('currentmatchid' in lower(pg_get_functiondef('public.server_join_room(uuid, uuid, text)'::regprocedure))) > 0
    and position('if found then' in lower(pg_get_functiondef('public.server_join_room(uuid, uuid, text)'::regprocedure))) > 0,
  'Reprise salon : un membre déjà présent récupère la partie courante'
);
select ok(
  position('''ROOM_EXPIRED''' in pg_get_functiondef('public.server_set_room_ready(uuid, uuid, uuid, bigint, boolean)'::regprocedure)) > 0
    and position('''ROOM_EXPIRED''' in pg_get_functiondef('public.server_start_match(uuid, uuid, uuid, bigint, uuid, text, jsonb, jsonb, uuid, timestamptz, text, jsonb, jsonb, jsonb, text, text, integer)'::regprocedure)) > 0,
  'Expiration salon : READY et START ne contournent pas l''échéance'
);
select ok(
  position('status = ''closed''' in lower(pg_get_functiondef('public.server_room_heartbeat(uuid, uuid)'::regprocedure))) > 0
    and position('v_room.expires_at <= clock_timestamp()' in pg_get_functiondef('public.server_room_heartbeat(uuid, uuid)'::regprocedure)) > 0,
  'Heartbeat salon : une attente échue devient fermée'
);
select ok(
  position('''currentMatchId'', v_room.current_match_id' in pg_get_functiondef('public.server_join_room(uuid, uuid, text)'::regprocedure)) > 0,
  'Reprise salon : la réponse conserve l''identifiant de partie'
);
select ok(
  position('''left'', true' in pg_get_functiondef('public.server_change_room(uuid, uuid, uuid, bigint, jsonb)'::regprocedure)) > 0
    and position('''closed''' in pg_get_functiondef('public.server_change_room(uuid, uuid, uuid, bigint, jsonb)'::regprocedure)) > 0,
  'Sortie salon : la réponse distingue sortie et fermeture'
);
select ok(
  position('''clue_timeout''' in pg_get_functiondef('public.server_commit_match(jsonb)'::regprocedure)) > 0
    and position('''guess_timeout''' in pg_get_functiondef('public.server_commit_match(jsonb)'::regprocedure)) > 0,
  'Longueur d''onde : le commit accepte les deux deadlines propres au jeu'
);
select ok(
  (select manifest->>'kind' from private.content_packs where kind = 'geography' and slug = 'france-metropole' and version = 1 and status = 'published' limit 1) = 'geography'
    and (select manifest->>'slug' from private.content_packs where kind = 'geography' and slug = 'france-metropole' and version = 1 and status = 'published' limit 1) = 'france-metropole'
    and (select manifest->>'packId' from private.content_packs where kind = 'geography' and slug = 'france-metropole' and version = 1 and status = 'published' limit 1) is not null,
  'Géographie : le manifeste publié respecte le contrat du loader'
);
select ok(
  (select manifest->>'checksum' from private.content_packs where kind = 'geography' and slug = 'france-metropole' and version = 1 and status = 'published' limit 1) = '3307baba3cb7a275b38a3b43e675b17a902060866abbfe93f5b83afca791c57d'
    and (select manifest->>'checksumEncoding' from private.content_packs where kind = 'geography' and slug = 'france-metropole' and version = 1 and status = 'published' limit 1) = 'stable-insee-code-order',
  'Géographie : le checksum publié suit le même ordre INSEE que la RPC'
);
select ok(
  has_function_privilege('service_role', 'private.try_uuid(text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'private.try_uuid(text)', 'EXECUTE')
    and not has_function_privilege('anon', 'private.try_uuid(text)', 'EXECUTE'),
  'Quiz : le trigger peut parser les UUID dans la transaction serveur sans ouvrir le helper aux clients'
);

select * from finish();
rollback;
