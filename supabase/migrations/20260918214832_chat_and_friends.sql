-- tibo.fun — chat général, conversations privées et amis.
--
-- Contenu, entièrement additif :
--   1. `private.friendships` : demande, acceptation, refus, retrait.
--   2. `private.chat_conversations` : conversation générale unique + paires
--      directes entre amis acceptés.
--   3. `private.chat_messages` : messages immuables, identifiants de requête
--      idempotents, pagination par `seq`, une image WebP optionnelle.
--   4. `private.chat_read_state` : marqueur de lecture par conversation.
--   5. `private.user_activity` : présence approximative (heartbeat).
--   6. Bucket privé `chat-images`, lecture par URL signée côté serveur.
--   7. RPC serveur : envoyer/valider une demande d'ami, retirer un ami,
--      ouvrir une conversation directe, envoyer/lire/marquer un message.
--   8. Triggers Broadcast sur le topic privé `chat:<uid>` (invalidation
--      uniquement) + politique SELECT Realtime correspondante.
--
-- Aucune migration déjà appliquée n'est réécrite ; toutes les définitions
-- sont nouvelles ou `create or replace`. Les invités actifs peuvent lire le
-- chat général ; l'écriture est réservée aux comptes permanents.

-- ---------------------------------------------------------------------------
-- 1. Amitiés
-- ---------------------------------------------------------------------------

create table if not exists private.friendships (
  id uuid primary key default extensions.gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete restrict,
  addressee_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'refused')),
  pair_low uuid not null,
  pair_high uuid not null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_not_self check (requester_id <> addressee_id),
  constraint friendships_pair_order check (pair_low < pair_high),
  constraint friendships_pair_members check (
    (pair_low = requester_id and pair_high = addressee_id)
    or (pair_low = addressee_id and pair_high = requester_id)
  ),
  constraint friendships_pair_unique unique (pair_low, pair_high)
);

create index if not exists friendships_addressee_pending_idx
  on private.friendships (addressee_id)
  where status = 'pending';

create index if not exists friendships_requester_idx
  on private.friendships (requester_id, status);

create index if not exists friendships_addressee_idx
  on private.friendships (addressee_id, status);

-- ---------------------------------------------------------------------------
-- 2. Conversations
-- ---------------------------------------------------------------------------

create table if not exists private.chat_conversations (
  id uuid primary key default extensions.gen_random_uuid(),
  kind text not null check (kind in ('general', 'direct')),
  direct_low uuid references public.profiles (id) on delete restrict,
  direct_high uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint chat_conversations_shape check (
    (kind = 'general' and direct_low is null and direct_high is null)
    or (
      kind = 'direct'
      and direct_low is not null and direct_high is not null
      and direct_low < direct_high
    )
  )
);

create unique index if not exists chat_conversations_general_unique_idx
  on private.chat_conversations (kind)
  where kind = 'general';

create unique index if not exists chat_conversations_direct_unique_idx
  on private.chat_conversations (direct_low, direct_high)
  where kind = 'direct';

-- Conversation générale unique et stable, créée de façon idempotente.
insert into private.chat_conversations (id, kind)
values ('00000000-0000-4000-8000-000000000001', 'general')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Messages
-- ---------------------------------------------------------------------------

create table if not exists private.chat_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  seq bigint generated always as identity,
  conversation_id uuid not null
    references private.chat_conversations (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete restrict,
  request_id uuid not null,
  body text,
  image_path text,
  image_width integer,
  image_height integer,
  created_at timestamptz not null default now(),
  constraint chat_messages_request_unique unique (author_id, request_id),
  constraint chat_messages_content check (body is not null or image_path is not null),
  constraint chat_messages_body_length check (
    body is null or char_length(body) between 1 and 1000
  ),
  constraint chat_messages_image_shape check (
    (image_path is null) = (image_width is null)
    and (image_path is null) = (image_height is null)
    and (image_width is null or image_width between 1 and 4096)
    and (image_height is null or image_height between 1 and 4096)
  )
);

create index if not exists chat_messages_conversation_seq_idx
  on private.chat_messages (conversation_id, seq desc);

create index if not exists chat_messages_author_created_idx
  on private.chat_messages (author_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Lecture et présence
-- ---------------------------------------------------------------------------

create table if not exists private.chat_read_state (
  user_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid not null
    references private.chat_conversations (id) on delete cascade,
  last_read_seq bigint not null default 0 check (last_read_seq >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

create table if not exists private.user_activity (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

create index if not exists user_activity_last_seen_idx
  on private.user_activity (last_seen_at desc);

-- ---------------------------------------------------------------------------
-- 5. Droits serveur et bucket privé
-- ---------------------------------------------------------------------------

grant all on private.friendships, private.chat_conversations,
  private.chat_messages, private.chat_read_state, private.user_activity
  to service_role;
grant all on all sequences in schema private to service_role;

insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 6. Helpers d'autorisation
-- ---------------------------------------------------------------------------

create or replace function private.is_active_member(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.site_members sm
    where sm.user_id = p_user_id
      and sm.status = 'active'
  );
$$;

create or replace function private.is_permanent_member(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.site_members sm
    where sm.user_id = p_user_id
      and sm.status = 'active'
      and sm.is_guest = false
  );
$$;

create or replace function private.chat_can_access(
  p_actor uuid,
  p_conversation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.chat_conversations c
    where c.id = p_conversation_id
      and (
        (
          c.kind = 'general'
          and exists (
            select 1
            from private.site_members sm
            where sm.user_id = p_actor and sm.status = 'active'
          )
        )
        or (
          c.kind = 'direct'
          and (c.direct_low = p_actor or c.direct_high = p_actor)
          and exists (
            select 1
            from private.friendships f
            where f.pair_low = c.direct_low
              and f.pair_high = c.direct_high
              and f.status = 'accepted'
          )
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- 7. Amis — demandes, réponses, retrait, conversation directe
-- ---------------------------------------------------------------------------

create or replace function public.server_send_friend_request(
  p_actor uuid,
  p_request_id uuid,
  p_target_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_hash text;
  v_receipt_hash text;
  v_low uuid;
  v_high uuid;
  v_friendship private.friendships%rowtype;
begin
  v_hash := encode(
    extensions.digest(convert_to(coalesce(p_target_id::text, ''), 'UTF8'), 'sha256'),
    'hex'
  );
  select response, payload_hash into v_existing, v_receipt_hash
  from private.request_receipts
  where actor_id = p_actor and request_id = p_request_id
    and route = 'send_friend_request';
  if v_existing is not null then
    if v_receipt_hash is distinct from v_hash then raise exception 'COMMAND_ID_REUSED'; end if;
    return v_existing;
  end if;

  if p_target_id is null then raise exception 'INVALID_REQUEST'; end if;
  if p_target_id = p_actor then raise exception 'CANNOT_FRIEND_SELF'; end if;
  if not private.is_permanent_member(p_actor) then raise exception 'ACCOUNT_REQUIRED'; end if;
  if not private.is_permanent_member(p_target_id) then raise exception 'FRIEND_TARGET_UNAVAILABLE'; end if;

  v_low := least(p_actor, p_target_id);
  v_high := greatest(p_actor, p_target_id);

  select * into v_friendship
  from private.friendships
  where pair_low = v_low and pair_high = v_high
  for update;

  if found then
    if v_friendship.status = 'accepted' then
      v_existing := jsonb_build_object(
        'friendshipId', v_friendship.id,
        'status', 'accepted',
        'direction', 'friends'
      );
      insert into private.request_receipts (actor_id, request_id, route, payload_hash, response)
      values (p_actor, p_request_id, 'send_friend_request', v_hash, v_existing)
      on conflict (actor_id, request_id) do nothing;
      return v_existing;
    end if;
    if v_friendship.status = 'pending' then
      v_existing := jsonb_build_object(
        'friendshipId', v_friendship.id,
        'status', 'pending',
        'direction', case when v_friendship.requester_id = p_actor then 'outgoing' else 'incoming' end
      );
      insert into private.request_receipts (actor_id, request_id, route, payload_hash, response)
      values (p_actor, p_request_id, 'send_friend_request', v_hash, v_existing)
      on conflict (actor_id, request_id) do nothing;
      return v_existing;
    end if;
    -- Refus antérieur : la même ligne repart en attente au profit du demandeur.
    update private.friendships
    set requester_id = p_actor,
        addressee_id = p_target_id,
        status = 'pending',
        created_at = clock_timestamp(),
        responded_at = null
    where id = v_friendship.id
    returning * into v_friendship;
  else
    insert into private.friendships (requester_id, addressee_id, status, pair_low, pair_high)
    values (p_actor, p_target_id, 'pending', v_low, v_high)
    returning * into v_friendship;
  end if;

  v_existing := jsonb_build_object(
    'friendshipId', v_friendship.id,
    'status', 'pending',
    'direction', 'outgoing'
  );
  insert into private.request_receipts (actor_id, request_id, route, payload_hash, response)
  values (p_actor, p_request_id, 'send_friend_request', v_hash, v_existing)
  on conflict (actor_id, request_id) do nothing;
  return v_existing;
end;
$$;

revoke all on function public.server_send_friend_request(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.server_send_friend_request(uuid, uuid, uuid) to service_role;

create or replace function public.server_respond_friend_request(
  p_actor uuid,
  p_request_id uuid,
  p_friendship_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_hash text;
  v_receipt_hash text;
  v_friendship private.friendships%rowtype;
  v_status text;
begin
  v_hash := encode(
    extensions.digest(
      convert_to(coalesce(p_friendship_id::text, '') || ':' || coalesce(p_accept::text, ''), 'UTF8'),
      'sha256'
    ),
    'hex'
  );
  select response, payload_hash into v_existing, v_receipt_hash
  from private.request_receipts
  where actor_id = p_actor and request_id = p_request_id
    and route = 'respond_friend_request';
  if v_existing is not null then
    if v_receipt_hash is distinct from v_hash then raise exception 'COMMAND_ID_REUSED'; end if;
    return v_existing;
  end if;

  if p_friendship_id is null or p_accept is null then raise exception 'INVALID_REQUEST'; end if;
  if not private.is_permanent_member(p_actor) then raise exception 'ACCOUNT_REQUIRED'; end if;

  select * into v_friendship
  from private.friendships
  where id = p_friendship_id
  for update;
  if not found then raise exception 'FRIEND_REQUEST_NOT_FOUND'; end if;
  if v_friendship.addressee_id <> p_actor or v_friendship.status <> 'pending' then
    raise exception 'FRIEND_REQUEST_NOT_FOUND';
  end if;

  v_status := case when p_accept then 'accepted' else 'refused' end;
  update private.friendships
  set status = v_status, responded_at = clock_timestamp()
  where id = p_friendship_id;

  v_existing := jsonb_build_object(
    'friendshipId', p_friendship_id,
    'status', v_status,
    'userId', v_friendship.requester_id
  );
  insert into private.request_receipts (actor_id, request_id, route, payload_hash, response)
  values (p_actor, p_request_id, 'respond_friend_request', v_hash, v_existing)
  on conflict (actor_id, request_id) do nothing;
  return v_existing;
end;
$$;

revoke all on function public.server_respond_friend_request(uuid, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.server_respond_friend_request(uuid, uuid, uuid, boolean) to service_role;

create or replace function public.server_remove_friend(
  p_actor uuid,
  p_request_id uuid,
  p_target_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_hash text;
  v_receipt_hash text;
  v_low uuid;
  v_high uuid;
  v_removed integer;
begin
  v_hash := encode(
    extensions.digest(convert_to(coalesce(p_target_id::text, ''), 'UTF8'), 'sha256'),
    'hex'
  );
  select response, payload_hash into v_existing, v_receipt_hash
  from private.request_receipts
  where actor_id = p_actor and request_id = p_request_id
    and route = 'remove_friend';
  if v_existing is not null then
    if v_receipt_hash is distinct from v_hash then raise exception 'COMMAND_ID_REUSED'; end if;
    return v_existing;
  end if;

  if p_target_id is null or p_target_id = p_actor then raise exception 'INVALID_REQUEST'; end if;
  if not private.is_permanent_member(p_actor) then raise exception 'ACCOUNT_REQUIRED'; end if;

  v_low := least(p_actor, p_target_id);
  v_high := greatest(p_actor, p_target_id);

  delete from private.friendships
  where pair_low = v_low and pair_high = v_high and status = 'accepted';
  get diagnostics v_removed = row_count;
  if v_removed = 0 then raise exception 'NOT_FRIENDS'; end if;

  v_existing := jsonb_build_object('removed', true, 'targetId', p_target_id);
  insert into private.request_receipts (actor_id, request_id, route, payload_hash, response)
  values (p_actor, p_request_id, 'remove_friend', v_hash, v_existing)
  on conflict (actor_id, request_id) do nothing;
  return v_existing;
end;
$$;

revoke all on function public.server_remove_friend(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.server_remove_friend(uuid, uuid, uuid) to service_role;

create or replace function public.server_open_direct_conversation(
  p_actor uuid,
  p_request_id uuid,
  p_target_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_hash text;
  v_receipt_hash text;
  v_low uuid;
  v_high uuid;
  v_conversation_id uuid;
begin
  v_hash := encode(
    extensions.digest(convert_to(coalesce(p_target_id::text, ''), 'UTF8'), 'sha256'),
    'hex'
  );
  select response, payload_hash into v_existing, v_receipt_hash
  from private.request_receipts
  where actor_id = p_actor and request_id = p_request_id
    and route = 'open_direct_conversation';
  if v_existing is not null then
    if v_receipt_hash is distinct from v_hash then raise exception 'COMMAND_ID_REUSED'; end if;
    return v_existing;
  end if;

  if p_target_id is null or p_target_id = p_actor then raise exception 'INVALID_REQUEST'; end if;
  if not private.is_permanent_member(p_actor) then raise exception 'ACCOUNT_REQUIRED'; end if;

  v_low := least(p_actor, p_target_id);
  v_high := greatest(p_actor, p_target_id);

  if not exists (
    select 1 from private.friendships
    where pair_low = v_low and pair_high = v_high and status = 'accepted'
  ) then
    raise exception 'NOT_FRIENDS';
  end if;

  select id into v_conversation_id
  from private.chat_conversations
  where kind = 'direct' and direct_low = v_low and direct_high = v_high;

  if v_conversation_id is null then
    insert into private.chat_conversations (kind, direct_low, direct_high)
    values ('direct', v_low, v_high)
    on conflict do nothing
    returning id into v_conversation_id;
    if v_conversation_id is null then
      select id into v_conversation_id
      from private.chat_conversations
      where kind = 'direct' and direct_low = v_low and direct_high = v_high;
    end if;
  end if;

  v_existing := jsonb_build_object('conversationId', v_conversation_id);
  insert into private.request_receipts (actor_id, request_id, route, payload_hash, response)
  values (p_actor, p_request_id, 'open_direct_conversation', v_hash, v_existing)
  on conflict (actor_id, request_id) do nothing;
  return v_existing;
end;
$$;

revoke all on function public.server_open_direct_conversation(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.server_open_direct_conversation(uuid, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 8. Messages — envoi, lecture, marquage lu
-- ---------------------------------------------------------------------------

create or replace function public.server_send_chat_message(
  p_actor uuid,
  p_request_id uuid,
  p_conversation_id uuid,
  p_body text,
  p_image_path text,
  p_image_width integer,
  p_image_height integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kind text;
  v_body text;
  v_message private.chat_messages%rowtype;
  v_recent integer;
begin
  if p_request_id is null or p_conversation_id is null then raise exception 'INVALID_REQUEST'; end if;
  if not private.is_permanent_member(p_actor) then raise exception 'ACCOUNT_REQUIRED'; end if;

  select kind into v_kind
  from private.chat_conversations
  where id = p_conversation_id;
  if not found then raise exception 'CONVERSATION_NOT_FOUND'; end if;
  if not private.chat_can_access(p_actor, p_conversation_id) then
    raise exception 'CONVERSATION_NOT_FOUND';
  end if;

  v_body := nullif(btrim(coalesce(p_body, '')), '');
  if v_body is not null and char_length(v_body) > 1000 then
    raise exception 'MESSAGE_TOO_LONG';
  end if;
  if v_body is null and p_image_path is null then
    raise exception 'MESSAGE_EMPTY';
  end if;
  if p_image_path is not null then
    if p_image_path not like p_actor::text || '/%'
       or p_image_path not like '%.webp'
       or position('..' in p_image_path) > 0
       or p_image_width is null
       or p_image_height is null then
      raise exception 'INVALID_REQUEST';
    end if;
  end if;

  select id, seq, conversation_id, author_id, body, image_path,
         image_width, image_height, created_at
  into v_message
  from private.chat_messages
  where author_id = p_actor and request_id = p_request_id;
  if found then
    return jsonb_build_object(
      'id', v_message.id,
      'seq', v_message.seq,
      'conversationId', v_message.conversation_id,
      'body', v_message.body,
      'imagePath', v_message.image_path,
      'imageWidth', v_message.image_width,
      'imageHeight', v_message.image_height,
      'createdAt', v_message.created_at
    );
  end if;

  select count(*) into v_recent
  from private.chat_messages
  where author_id = p_actor
    and created_at > clock_timestamp() - interval '60 seconds';
  if v_recent >= 30 then raise exception 'RATE_LIMITED'; end if;

  insert into private.chat_messages (
    conversation_id, author_id, request_id, body, image_path, image_width, image_height
  ) values (
    p_conversation_id, p_actor, p_request_id, v_body, p_image_path, p_image_width, p_image_height
  )
  returning * into v_message;

  return jsonb_build_object(
    'id', v_message.id,
    'seq', v_message.seq,
    'conversationId', v_message.conversation_id,
    'body', v_message.body,
    'imagePath', v_message.image_path,
    'imageWidth', v_message.image_width,
    'imageHeight', v_message.image_height,
    'createdAt', v_message.created_at
  );
end;
$$;

revoke all on function public.server_send_chat_message(uuid, uuid, uuid, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.server_send_chat_message(uuid, uuid, uuid, text, text, integer, integer) to service_role;

create or replace function public.server_mark_chat_read(
  p_actor uuid,
  p_conversation_id uuid,
  p_last_read_seq bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_seq bigint;
begin
  if p_conversation_id is null or p_last_read_seq is null or p_last_read_seq < 0 then
    raise exception 'INVALID_REQUEST';
  end if;
  if not private.chat_can_access(p_actor, p_conversation_id) then
    raise exception 'CONVERSATION_NOT_FOUND';
  end if;

  insert into private.chat_read_state (user_id, conversation_id, last_read_seq)
  values (p_actor, p_conversation_id, p_last_read_seq)
  on conflict (user_id, conversation_id) do update
  set last_read_seq = greatest(private.chat_read_state.last_read_seq, excluded.last_read_seq),
      updated_at = clock_timestamp()
  returning last_read_seq into v_seq;

  return jsonb_build_object('conversationId', p_conversation_id, 'lastReadSeq', v_seq);
end;
$$;

revoke all on function public.server_mark_chat_read(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.server_mark_chat_read(uuid, uuid, bigint) to service_role;

-- ---------------------------------------------------------------------------
-- 9. Présence approximative
-- ---------------------------------------------------------------------------

create or replace function public.server_record_activity(p_actor uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_last_seen timestamptz;
begin
  if not private.is_active_member(p_actor) then raise exception 'MEMBER_REQUIRED'; end if;

  insert into private.user_activity (user_id, last_seen_at)
  values (p_actor, clock_timestamp())
  on conflict (user_id) do update set last_seen_at = excluded.last_seen_at
  returning last_seen_at into v_last_seen;

  delete from private.user_activity
  where last_seen_at < clock_timestamp() - interval '30 days';

  return jsonb_build_object('lastSeenAt', v_last_seen);
end;
$$;

revoke all on function public.server_record_activity(uuid) from public, anon, authenticated;
grant execute on function public.server_record_activity(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 10. Lectures serveur — résumé et messages paginés
-- ---------------------------------------------------------------------------

create or replace function public.server_get_chat_summary(p_actor uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_general_id uuid;
  v_general jsonb;
  v_friends jsonb;
  v_incoming jsonb;
  v_outgoing jsonb;
  v_online integer;
begin
  if not private.is_active_member(p_actor) then raise exception 'MEMBER_REQUIRED'; end if;

  select id into v_general_id
  from private.chat_conversations
  where kind = 'general';

  select jsonb_build_object(
    'conversationId', v_general_id,
    'unread', (
      select count(*)
      from private.chat_messages m
      left join private.chat_read_state rs
        on rs.user_id = p_actor and rs.conversation_id = m.conversation_id
      where m.conversation_id = v_general_id
        and m.author_id <> p_actor
        and m.seq > coalesce(rs.last_read_seq, 0)
    ),
    'messageCount', (
      select count(*) from private.chat_messages where conversation_id = v_general_id
    ),
    'lastMessage', (
      select jsonb_build_object(
        'id', m.id,
        'seq', m.seq,
        'authorId', m.author_id,
        'body', m.body,
        'imagePath', m.image_path,
        'createdAt', m.created_at
      )
      from private.chat_messages m
      where m.conversation_id = v_general_id
      order by m.seq desc
      limit 1
    )
  ) into v_general;

  select coalesce(jsonb_agg(entry order by entry->>'lastMessageAt' desc nulls last), '[]'::jsonb)
  into v_friends
  from (
    select jsonb_build_object(
      'userId', p.id,
      'name', coalesce(p.display_name, p.account_name, p.pseudo),
      'avatarPath', p.avatar_path,
      'avatarPreset', p.avatar_preset,
      'online', coalesce((
        select ua.last_seen_at > clock_timestamp() - interval '2 minutes'
        from private.user_activity ua
        where ua.user_id = p.id
      ), false),
      'conversationId', c.id,
      'unread', coalesce((
        select count(*)
        from private.chat_messages m
        left join private.chat_read_state rs
          on rs.user_id = p_actor and rs.conversation_id = m.conversation_id
        where c.id is not null
          and m.conversation_id = c.id
          and m.author_id <> p_actor
          and m.seq > coalesce(rs.last_read_seq, 0)
      ), 0),
      'lastMessageAt', lm.created_at,
      'lastMessage', case when lm.id is null then null else jsonb_build_object(
        'id', lm.id,
        'seq', lm.seq,
        'authorId', lm.author_id,
        'body', lm.body,
        'imagePath', lm.image_path,
        'createdAt', lm.created_at
      ) end
    ) as entry
    from private.friendships f
    join public.profiles p
      on p.id = case when f.requester_id = p_actor then f.addressee_id else f.requester_id end
    left join private.chat_conversations c
      on c.kind = 'direct'
      and c.direct_low = f.pair_low
      and c.direct_high = f.pair_high
    left join lateral (
      select m.*
      from private.chat_messages m
      where c.id is not null and m.conversation_id = c.id
      order by m.seq desc
      limit 1
    ) lm on true
    where f.status = 'accepted'
      and (f.requester_id = p_actor or f.addressee_id = p_actor)
  ) friends;

  select coalesce(jsonb_agg(entry order by entry->>'createdAt' desc), '[]'::jsonb)
  into v_incoming
  from (
    select jsonb_build_object(
      'friendshipId', f.id,
      'userId', p.id,
      'name', coalesce(p.display_name, p.account_name, p.pseudo),
      'avatarPath', p.avatar_path,
      'avatarPreset', p.avatar_preset,
      'createdAt', f.created_at
    ) as entry
    from private.friendships f
    join public.profiles p on p.id = f.requester_id
    where f.addressee_id = p_actor and f.status = 'pending'
  ) incoming;

  select coalesce(jsonb_agg(entry order by entry->>'createdAt' desc), '[]'::jsonb)
  into v_outgoing
  from (
    select jsonb_build_object(
      'friendshipId', f.id,
      'userId', p.id,
      'name', coalesce(p.display_name, p.account_name, p.pseudo),
      'avatarPath', p.avatar_path,
      'avatarPreset', p.avatar_preset,
      'createdAt', f.created_at
    ) as entry
    from private.friendships f
    join public.profiles p on p.id = f.addressee_id
    where f.requester_id = p_actor and f.status = 'pending'
  ) outgoing;

  select count(*) into v_online
  from private.user_activity ua
  join private.site_members sm on sm.user_id = ua.user_id and sm.status = 'active'
  where ua.last_seen_at > clock_timestamp() - interval '2 minutes';

  return jsonb_build_object(
    'general', v_general,
    'friends', v_friends,
    'incomingRequests', v_incoming,
    'outgoingRequests', v_outgoing,
    'onlineCount', v_online
  );
end;
$$;

revoke all on function public.server_get_chat_summary(uuid) from public, anon, authenticated;
grant execute on function public.server_get_chat_summary(uuid) to service_role;

create or replace function public.server_get_chat_messages(
  p_actor uuid,
  p_conversation_id uuid,
  p_before_seq bigint,
  p_limit integer
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_limit integer;
  v_conversation private.chat_conversations%rowtype;
  v_messages jsonb;
  v_min_seq bigint;
  v_has_more boolean;
  v_members jsonb;
  v_title text;
begin
  if p_conversation_id is null then raise exception 'INVALID_REQUEST'; end if;
  if not private.is_active_member(p_actor) then raise exception 'MEMBER_REQUIRED'; end if;
  if not private.chat_can_access(p_actor, p_conversation_id) then
    raise exception 'CONVERSATION_NOT_FOUND';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 50), 1), 100);

  select * into v_conversation
  from private.chat_conversations
  where id = p_conversation_id;

  select coalesce(jsonb_agg(message order by (message->>'seq')::bigint), '[]'::jsonb)
  into v_messages
  from (
    select jsonb_build_object(
      'id', m.id,
      'seq', m.seq,
      'authorId', m.author_id,
      'authorName', coalesce(p.display_name, p.account_name, p.pseudo),
      'authorAvatarPath', p.avatar_path,
      'authorAvatarPreset', p.avatar_preset,
      'authorIsGuest', coalesce(sm.is_guest, false),
      'body', m.body,
      'imagePath', m.image_path,
      'imageWidth', m.image_width,
      'imageHeight', m.image_height,
      'createdAt', m.created_at
    ) as message
    from private.chat_messages m
    join public.profiles p on p.id = m.author_id
    left join private.site_members sm on sm.user_id = m.author_id
    where m.conversation_id = p_conversation_id
      and (p_before_seq is null or m.seq < p_before_seq)
    order by m.seq desc
    limit v_limit
  ) page;

  select min((message->>'seq')::bigint) into v_min_seq
  from jsonb_array_elements(v_messages) as message;

  v_has_more := case
    when v_min_seq is null then false
    else exists (
      select 1 from private.chat_messages
      where conversation_id = p_conversation_id and seq < v_min_seq
    )
  end;

  if v_conversation.kind = 'general' then
    v_title := 'Général';
    v_members := '[]'::jsonb;
  else
    select jsonb_build_object(
      'userId', p.id,
      'name', coalesce(p.display_name, p.account_name, p.pseudo),
      'avatarPath', p.avatar_path,
      'avatarPreset', p.avatar_preset,
      'online', coalesce((
        select ua.last_seen_at > clock_timestamp() - interval '2 minutes'
        from private.user_activity ua
        where ua.user_id = p.id
      ), false)
    )
    into v_members
    from public.profiles p
    where p.id = case
      when v_conversation.direct_low = p_actor then v_conversation.direct_high
      else v_conversation.direct_low
    end;
    v_title := coalesce(v_members->>'name', 'Conversation');
  end if;

  return jsonb_build_object(
    'conversation', jsonb_build_object(
      'id', v_conversation.id,
      'kind', v_conversation.kind,
      'title', v_title,
      'member', v_members
    ),
    'messages', v_messages,
    'hasMore', v_has_more
  );
end;
$$;

revoke all on function public.server_get_chat_messages(uuid, uuid, bigint, integer) from public, anon, authenticated;
grant execute on function public.server_get_chat_messages(uuid, uuid, bigint, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 11. Broadcast Realtime (invalidation seule) et politique de topic
-- ---------------------------------------------------------------------------

drop policy if exists chat_broadcast_receive on realtime.messages;

create policy chat_broadcast_receive
on realtime.messages
for select
to authenticated
using (
  realtime.topic() = 'chat:' || (select auth.uid())::text
  and private = true
  and extension = 'broadcast'
  and topic = 'chat:' || (select auth.uid())::text
  and (select public.is_site_member())
);

create or replace function private.broadcast_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_low uuid;
  v_high uuid;
  v_recipient uuid;
begin
  select kind, direct_low, direct_high
  into v_kind, v_low, v_high
  from private.chat_conversations
  where id = new.conversation_id;

  if v_kind = 'general' then
    for v_recipient in
      select user_id from private.site_members where status = 'active'
    loop
      perform realtime.send(
        jsonb_build_object('id', new.conversation_id, 'version', new.seq),
        'chat.updated',
        'chat:' || v_recipient::text,
        true
      );
    end loop;
  elsif v_kind = 'direct' then
    perform realtime.send(
      jsonb_build_object('id', new.conversation_id, 'version', new.seq),
      'chat.updated',
      'chat:' || v_low::text,
      true
    );
    perform realtime.send(
      jsonb_build_object('id', new.conversation_id, 'version', new.seq),
      'chat.updated',
      'chat:' || v_high::text,
      true
    );
  end if;
  return new;
end;
$$;

drop trigger if exists chat_messages_broadcast_insert on private.chat_messages;
create trigger chat_messages_broadcast_insert
after insert on private.chat_messages
for each row execute function private.broadcast_chat_message();

create or replace function private.broadcast_friend_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.friendships%rowtype;
begin
  if tg_op = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;
  perform realtime.send(
    jsonb_build_object('id', v_row.id, 'version', 1),
    'friend.updated',
    'chat:' || v_row.requester_id::text,
    true
  );
  perform realtime.send(
    jsonb_build_object('id', v_row.id, 'version', 1),
    'friend.updated',
    'chat:' || v_row.addressee_id::text,
    true
  );
  return null;
end;
$$;

drop trigger if exists friendships_broadcast_change on private.friendships;
create trigger friendships_broadcast_change
after insert or update or delete on private.friendships
for each row execute function private.broadcast_friend_update();
