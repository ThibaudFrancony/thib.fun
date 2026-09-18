-- tibo.fun — correction du membre de conversation dans server_get_chat_messages.
--
-- Cause confirmée : pour la conversation générale, la fonction renvoyait
-- `"member": []` (tableau JSON). Le schéma zod serveur attend un objet ou
-- `null`, donc chaque lecture du chat général échouait en DATABASE_UNAVAILABLE
-- et l'UI affichait « La conversation n'est pas prête. » à l'envoi.
--
-- Correction additive : `member` reste `null` pour le général et demeure un
-- objet pour une conversation directe. Aucune signature ni aucun droit ne
-- change ; `create or replace` conserve les grants déjà posés.

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
    v_members := null;
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
