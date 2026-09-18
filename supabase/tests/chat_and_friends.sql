begin;

select plan(32);

-- ---------------------------------------------------------------------------
-- Structure, privilèges et realtime
-- ---------------------------------------------------------------------------

select ok(
  exists (select 1 from information_schema.tables where table_schema = 'private' and table_name = 'friendships'),
  'Chat : la table des amitiés existe'
);

select ok(
  exists (select 1 from information_schema.tables where table_schema = 'private' and table_name = 'chat_messages')
    and exists (select 1 from information_schema.tables where table_schema = 'private' and table_name = 'chat_conversations'),
  'Chat : conversations et messages existent'
);

select ok(
  exists (select 1 from information_schema.tables where table_schema = 'private' and table_name = 'chat_read_state')
    and exists (select 1 from information_schema.tables where table_schema = 'private' and table_name = 'user_activity'),
  'Chat : lecture et présence existent'
);

select is(
  (select count(*)::int from private.chat_conversations where kind = 'general'),
  1,
  'Chat : une seule conversation générale est semée'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'chat_messages_request_unique'),
  'Chat : l''idempotence (author_id, request_id) est contrainte'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'realtime' and tablename = 'messages' and policyname = 'chat_broadcast_receive'
  ),
  'Chat : le topic privé chat:<uid> est couvert par une politique Realtime'
);

select ok(
  exists (select 1 from storage.buckets where id = 'chat-images' and public = false),
  'Chat : le bucket chat-images est privé'
);

select ok(
  (select prosecdef from pg_proc where oid = 'public.server_send_friend_request(uuid, uuid, uuid)'::regprocedure) = false,
  'Chat : send_friend_request est SECURITY INVOKER'
);

select ok(
  has_function_privilege('service_role', 'public.server_send_friend_request(uuid, uuid, uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.server_send_friend_request(uuid, uuid, uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.server_send_friend_request(uuid, uuid, uuid)', 'EXECUTE'),
  'Chat : send_friend_request est réservé au rôle serveur'
);

select ok(
  (select prosecdef from pg_proc where oid = 'public.server_send_chat_message(uuid, uuid, uuid, text, text, integer, integer)'::regprocedure) = false,
  'Chat : send_chat_message est SECURITY INVOKER'
);

select ok(
  has_function_privilege('service_role', 'public.server_send_chat_message(uuid, uuid, uuid, text, text, integer, integer)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.server_send_chat_message(uuid, uuid, uuid, text, text, integer, integer)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.server_send_chat_message(uuid, uuid, uuid, text, text, integer, integer)', 'EXECUTE'),
  'Chat : send_chat_message est réservé au rôle serveur'
);

select ok(
  exists (select 1 from pg_proc where oid = 'private.is_permanent_member(uuid)'::regprocedure),
  'Chat : l''écriture permanente dispose d''un helper dédié'
);

select ok(
  exists (select 1 from pg_trigger where tgname = 'friendships_broadcast_change')
    and exists (select 1 from pg_trigger where tgname = 'chat_messages_broadcast_insert'),
  'Chat : les triggers Broadcast des amitiés et des messages existent'
);

-- ---------------------------------------------------------------------------
-- Identités de test
-- ---------------------------------------------------------------------------

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
)
values
  (
    '00000000-0000-4000-8000-00000000a101', 'authenticated', 'authenticated',
    'chat-alice@example.invalid', clock_timestamp(), '{}'::jsonb, '{}'::jsonb,
    clock_timestamp(), clock_timestamp(), false, false
  ),
  (
    '00000000-0000-4000-8000-00000000a102', 'authenticated', 'authenticated',
    'chat-bob@example.invalid', clock_timestamp(), '{}'::jsonb, '{}'::jsonb,
    clock_timestamp(), clock_timestamp(), false, false
  ),
  (
    '00000000-0000-4000-8000-00000000a103', 'authenticated', 'authenticated',
    'chat-carol@example.invalid', clock_timestamp(), '{}'::jsonb, '{}'::jsonb,
    clock_timestamp(), clock_timestamp(), false, false
  ),
  (
    '00000000-0000-4000-8000-00000000a104', 'authenticated', 'authenticated',
    null, clock_timestamp(), '{}'::jsonb, '{}'::jsonb,
    clock_timestamp(), clock_timestamp(), false, true
  );

-- ---------------------------------------------------------------------------
-- Demande d'ami : envoi, doublon, acceptation
-- ---------------------------------------------------------------------------

select is(
  public.server_send_friend_request(
    '00000000-0000-4000-8000-00000000a101'::uuid,
    '00000000-0000-4000-8000-00000000b101'::uuid,
    '00000000-0000-4000-8000-00000000a102'::uuid
  )->>'status',
  'pending',
  'Chat : une demande d''ami part en attente'
);

select is(
  public.server_send_friend_request(
    '00000000-0000-4000-8000-00000000a101'::uuid,
    '00000000-0000-4000-8000-00000000b101'::uuid,
    '00000000-0000-4000-8000-00000000a102'::uuid
  )->>'friendshipId',
  (select id::text from private.friendships where pair_low = '00000000-0000-4000-8000-00000000a101'::uuid),
  'Chat : rejouer la même requête renvoie la même amitié'
);

select throws_ok(
  $q$
    select public.server_send_friend_request(
      '00000000-0000-4000-8000-00000000a101'::uuid,
      '00000000-0000-4000-8000-00000000b102'::uuid,
      '00000000-0000-4000-8000-00000000a101'::uuid
    )
  $q$,
  'P0001',
  'CANNOT_FRIEND_SELF',
  'Chat : impossible de s''ajouter soi-même'
);

select is(
  public.server_respond_friend_request(
    '00000000-0000-4000-8000-00000000a102'::uuid,
    '00000000-0000-4000-8000-00000000b103'::uuid,
    (select id from private.friendships where pair_low = '00000000-0000-4000-8000-00000000a101'::uuid),
    true
  )->>'status',
  'accepted',
  'Chat : le destinataire accepte la demande'
);

-- ---------------------------------------------------------------------------
-- Conversation privée entre amis
-- ---------------------------------------------------------------------------

select is(
  public.server_open_direct_conversation(
    '00000000-0000-4000-8000-00000000a101'::uuid,
    '00000000-0000-4000-8000-00000000b104'::uuid,
    '00000000-0000-4000-8000-00000000a102'::uuid
  )->>'conversationId',
  public.server_open_direct_conversation(
    '00000000-0000-4000-8000-00000000a101'::uuid,
    '00000000-0000-4000-8000-00000000b105'::uuid,
    '00000000-0000-4000-8000-00000000a102'::uuid
  )->>'conversationId',
  'Chat : la conversation directe est stable et unique'
);

create temp table chat_ctx as
select
  (select id from private.chat_conversations where kind = 'direct') as conversation_id,
  public.server_send_chat_message(
    '00000000-0000-4000-8000-00000000a101'::uuid,
    '00000000-0000-4000-8000-00000000b106'::uuid,
    (select id from private.chat_conversations where kind = 'direct'),
    'Bonjour Bob',
    null,
    null,
    null
  ) as message;

select ok(
  (select (message->>'seq')::bigint > 0 and message->>'body' = 'Bonjour Bob' from chat_ctx),
  'Chat : un message privé est enregistré avec sa séquence'
);

select is(
  public.server_send_chat_message(
    '00000000-0000-4000-8000-00000000a101'::uuid,
    '00000000-0000-4000-8000-00000000b106'::uuid,
    (select conversation_id from chat_ctx),
    'Autre texte',
    null,
    null,
    null
  )->>'id',
  (select message->>'id' from chat_ctx),
  'Chat : rejouer la même requête renvoie le même message'
);

select is(
  (select count(*)::int from private.chat_messages where author_id = '00000000-0000-4000-8000-00000000a101'::uuid),
  1,
  'Chat : aucun doublon de message n''est créé'
);

select throws_ok(
  $q$
    select public.server_send_chat_message(
      '00000000-0000-4000-8000-00000000a101'::uuid,
      '00000000-0000-4000-8000-00000000b107'::uuid,
      (select conversation_id from chat_ctx),
      null, null, null, null
    )
  $q$,
  'P0001',
  'MESSAGE_EMPTY',
  'Chat : un message sans texte ni image est refusé'
);

select throws_ok(
  $q$
    select public.server_get_chat_messages(
      '00000000-0000-4000-8000-00000000a103'::uuid,
      (select conversation_id from chat_ctx),
      null::bigint,
      50
    )
  $q$,
  'P0001',
  'CONVERSATION_NOT_FOUND',
  'Chat : un tiers ne lit pas une conversation privée'
);

select is(
  (public.server_get_chat_summary('00000000-0000-4000-8000-00000000a102'::uuid)->'friends'->0->>'unread')::int,
  1,
  'Chat : le destinataire voit un non-lu'
);

select is(
  (
    public.server_mark_chat_read(
      '00000000-0000-4000-8000-00000000a102'::uuid,
      (select conversation_id from chat_ctx),
      (select (message->>'seq')::bigint from chat_ctx)
    )->>'lastReadSeq'
  )::bigint,
  (select (message->>'seq')::bigint from chat_ctx),
  'Chat : le marqueur de lecture est enregistré'
);

select is(
  (public.server_get_chat_summary('00000000-0000-4000-8000-00000000a102'::uuid)->'friends'->0->>'unread')::int,
  0,
  'Chat : le non-lu retombe à zéro après lecture'
);

-- ---------------------------------------------------------------------------
-- Chat général : invité lecteur, écriture interdite
-- ---------------------------------------------------------------------------

select throws_ok(
  $q$
    select public.server_send_chat_message(
      '00000000-0000-4000-8000-00000000a104'::uuid,
      '00000000-0000-4000-8000-00000000b108'::uuid,
      (select id from private.chat_conversations where kind = 'general'),
      'Coucou',
      null, null, null
    )
  $q$,
  'P0001',
  'ACCOUNT_REQUIRED',
  'Chat : un invité ne peut pas écrire dans le chat général'
);

select ok(
  (public.server_get_chat_summary('00000000-0000-4000-8000-00000000a104'::uuid)->'general'->>'conversationId') is not null,
  'Chat : un invité actif peut lire le chat général'
);

-- ---------------------------------------------------------------------------
-- Retrait d'ami : accès privé perdu
-- ---------------------------------------------------------------------------

select is(
  public.server_remove_friend(
    '00000000-0000-4000-8000-00000000a101'::uuid,
    '00000000-0000-4000-8000-00000000b109'::uuid,
    '00000000-0000-4000-8000-00000000a102'::uuid
  )->>'removed',
  'true',
  'Chat : un ami peut être retiré'
);

select throws_ok(
  $q$
    select public.server_remove_friend(
      '00000000-0000-4000-8000-00000000a101'::uuid,
      '00000000-0000-4000-8000-00000000b110'::uuid,
      '00000000-0000-4000-8000-00000000a102'::uuid
    )
  $q$,
  'P0001',
  'NOT_FRIENDS',
  'Chat : retirer deux fois le même ami est refusé'
);

select throws_ok(
  $q$
    select public.server_get_chat_messages(
      '00000000-0000-4000-8000-00000000a101'::uuid,
      (select conversation_id from chat_ctx),
      null::bigint,
      50
    )
  $q$,
  'P0001',
  'CONVERSATION_NOT_FOUND',
  'Chat : après retrait, la conversation privée n''est plus accessible'
);

-- ---------------------------------------------------------------------------
-- Présence approximative
-- ---------------------------------------------------------------------------

select public.server_record_activity('00000000-0000-4000-8000-00000000a101'::uuid);

select ok(
  (public.server_get_chat_summary('00000000-0000-4000-8000-00000000a102'::uuid)->>'onlineCount')::int >= 1,
  'Chat : le heartbeat alimente le compteur de présence'
);

select * from finish();

rollback;
