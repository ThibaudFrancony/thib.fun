-- tibo.fun — console d'administration.
--
-- Contenu, entièrement additif :
--   1. `public.games.visible` : masquage d'un jeu sur l'accueil sans bloquer
--      sa route.
--   2. `private.admin_accounts` : liste blanche d'e-mails administrateurs,
--      comparée à `auth.users.email` côté base (jamais fournie par le client).
--   3. `private.is_admin_account` / `public.server_is_admin` : contrôle
--      d'accès serveur et base.
--   4. RPC `server_admin_*` réservées au rôle serveur qui revalident
--      l'administrateur : lister les jeux, changer leur visibilité, lister
--      toutes les conversations et lire une conversation en lecture seule.
--
-- Aucune donnée de chat n'est créée ou modifiée : l'admin observe les mêmes
-- tables que le chat, sans appartenance ni possibilité d'écriture privée.

-- ---------------------------------------------------------------------------
-- 1. Visibilité des jeux
-- ---------------------------------------------------------------------------

alter table public.games add column if not exists visible boolean not null default true;

-- Le rôle serveur met à jour la visibilité via la RPC ; RLS reste sans policy
-- d'écriture pour les membres.
grant select, update on table public.games to service_role;

-- ---------------------------------------------------------------------------
-- 2. Comptes administrateurs
-- ---------------------------------------------------------------------------

create table if not exists private.admin_accounts (
  email text primary key,
  created_at timestamptz not null default now(),
  constraint admin_accounts_email_lower check (email = lower(email))
);

insert into private.admin_accounts (email)
values ('thfrancony@gmail.com')
on conflict (email) do nothing;

grant all on private.admin_accounts to service_role;

create or replace function private.is_admin_account(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and exists (
    select 1
    from private.admin_accounts aa
    join auth.users u on lower(u.email) = aa.email
    where u.id = p_user_id
  );
$$;

revoke all on function private.is_admin_account(uuid) from public, anon, authenticated;

create or replace function public.server_is_admin(p_actor uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_admin_account(p_actor);
$$;

revoke all on function public.server_is_admin(uuid) from public, anon, authenticated;
grant execute on function public.server_is_admin(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Visibilité des jeux : lecture admin et bascule idempotente
-- ---------------------------------------------------------------------------

create or replace function public.server_admin_list_games(p_actor uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_games jsonb;
begin
  if not private.is_admin_account(p_actor) then raise exception 'ADMIN_REQUIRED'; end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'slug', g.slug,
        'visible', g.visible,
        'availability', g.availability
      )
      order by g.priority, g.slug
    ),
    '[]'::jsonb
  )
  into v_games
  from public.games g;

  return v_games;
end;
$$;

revoke all on function public.server_admin_list_games(uuid) from public, anon, authenticated;
grant execute on function public.server_admin_list_games(uuid) to service_role;

create or replace function public.server_admin_set_game_visibility(
  p_actor uuid,
  p_request_id uuid,
  p_slug text,
  p_visible boolean
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
  v_updated integer;
begin
  if p_request_id is null or p_slug is null or p_visible is null then
    raise exception 'INVALID_REQUEST';
  end if;

  v_hash := encode(
    extensions.digest(convert_to(p_slug || ':' || p_visible::text, 'UTF8'), 'sha256'),
    'hex'
  );
  select response, payload_hash into v_existing, v_receipt_hash
  from private.request_receipts
  where actor_id = p_actor and request_id = p_request_id
    and route = 'admin_set_game_visibility';
  if v_existing is not null then
    if v_receipt_hash is distinct from v_hash then raise exception 'COMMAND_ID_REUSED'; end if;
    return v_existing;
  end if;

  if not private.is_admin_account(p_actor) then raise exception 'ADMIN_REQUIRED'; end if;

  update public.games set visible = p_visible where slug = p_slug;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then raise exception 'GAME_NOT_FOUND'; end if;

  v_existing := jsonb_build_object('slug', p_slug, 'visible', p_visible);
  insert into private.request_receipts (actor_id, request_id, route, payload_hash, response)
  values (p_actor, p_request_id, 'admin_set_game_visibility', v_hash, v_existing)
  on conflict (actor_id, request_id) do nothing;
  return v_existing;
end;
$$;

revoke all on function public.server_admin_set_game_visibility(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.server_admin_set_game_visibility(uuid, uuid, text, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Vue admin des discussions
-- ---------------------------------------------------------------------------

create or replace function public.server_admin_list_conversations(p_actor uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not private.is_admin_account(p_actor) then raise exception 'ADMIN_REQUIRED'; end if;

  select coalesce(
    jsonb_agg(entry order by (entry->>'kind') desc, (entry->>'lastMessageAt') desc nulls last),
    '[]'::jsonb
  )
  into v_result
  from (
    select jsonb_build_object(
      'id', c.id,
      'kind', c.kind,
      'title', case
        when c.kind = 'general' then 'Chat général'
        else coalesce((
          select coalesce(p.display_name, p.account_name, p.pseudo)
          from public.profiles p where p.id = c.direct_low
        ), '?') || ' & ' || coalesce((
          select coalesce(p.display_name, p.account_name, p.pseudo)
          from public.profiles p where p.id = c.direct_high
        ), '?')
      end,
      'members', case
        when c.kind = 'general' then '[]'::jsonb
        else coalesce((
          select jsonb_agg(jsonb_build_object(
            'userId', p.id,
            'name', coalesce(p.display_name, p.account_name, p.pseudo),
            'avatarPath', p.avatar_path,
            'avatarPreset', p.avatar_preset,
            'isGuest', coalesce(sm.is_guest, false)
          ) order by p.id)
          from public.profiles p
          left join private.site_members sm on sm.user_id = p.id
          where p.id in (c.direct_low, c.direct_high)
        ), '[]'::jsonb)
      end,
      'messageCount', (
        select count(*) from private.chat_messages m where m.conversation_id = c.id
      ),
      'lastMessageAt', (
        select max(m.created_at) from private.chat_messages m where m.conversation_id = c.id
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
        where m.conversation_id = c.id
        order by m.seq desc
        limit 1
      )
    ) as entry
    from private.chat_conversations c
  ) entries;

  return v_result;
end;
$$;

revoke all on function public.server_admin_list_conversations(uuid) from public, anon, authenticated;
grant execute on function public.server_admin_list_conversations(uuid) to service_role;

create or replace function public.server_admin_get_conversation(
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
  if not private.is_admin_account(p_actor) then raise exception 'ADMIN_REQUIRED'; end if;

  v_limit := least(greatest(coalesce(p_limit, 30), 1), 100);

  select * into v_conversation
  from private.chat_conversations
  where id = p_conversation_id;
  if not found then raise exception 'CONVERSATION_NOT_FOUND'; end if;

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
    v_members := '[]'::jsonb;
    v_title := 'Chat général';
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'userId', p.id,
      'name', coalesce(p.display_name, p.account_name, p.pseudo),
      'avatarPath', p.avatar_path,
      'avatarPreset', p.avatar_preset,
      'isGuest', coalesce(sm.is_guest, false)
    ) order by p.id), '[]'::jsonb)
    into v_members
    from public.profiles p
    left join private.site_members sm on sm.user_id = p.id
    where p.id in (v_conversation.direct_low, v_conversation.direct_high);

    v_title := coalesce((
      select coalesce(p.display_name, p.account_name, p.pseudo)
      from public.profiles p where p.id = v_conversation.direct_low
    ), '?') || ' & ' || coalesce((
      select coalesce(p.display_name, p.account_name, p.pseudo)
      from public.profiles p where p.id = v_conversation.direct_high
    ), '?');
  end if;

  return jsonb_build_object(
    'conversation', jsonb_build_object(
      'id', v_conversation.id,
      'kind', v_conversation.kind,
      'title', v_title,
      'members', v_members
    ),
    'messages', v_messages,
    'hasMore', v_has_more
  );
end;
$$;

revoke all on function public.server_admin_get_conversation(uuid, uuid, bigint, integer) from public, anon, authenticated;
grant execute on function public.server_admin_get_conversation(uuid, uuid, bigint, integer) to service_role;
