begin;

select plan(21);

-- ---------------------------------------------------------------------------
-- Structure, privilèges et contrôle base
-- ---------------------------------------------------------------------------

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games' and column_name = 'visible'
  ),
  'Admin : public.games.visible existe'
);

select ok(
  exists (select 1 from private.admin_accounts where email = 'thfrancony@gmail.com'),
  'Admin : le compte administrateur est semé'
);

select ok(
  exists (select 1 from pg_proc where oid = 'private.is_admin_account(uuid)'::regprocedure)
    and (select prosecdef from pg_proc where oid = 'private.is_admin_account(uuid)'::regprocedure),
  'Admin : is_admin_account est SECURITY DEFINER'
);

select ok(
  (select prosecdef from pg_proc where oid = 'public.server_is_admin(uuid)'::regprocedure) = false
    and has_function_privilege('service_role', 'public.server_is_admin(uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.server_is_admin(uuid)', 'EXECUTE'),
  'Admin : server_is_admin est réservé au rôle serveur'
);

select ok(
  (select prosecdef from pg_proc where oid = 'public.server_admin_list_games(uuid)'::regprocedure) = false
    and has_function_privilege('service_role', 'public.server_admin_list_games(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.server_admin_list_games(uuid)', 'EXECUTE'),
  'Admin : list_games est réservé au rôle serveur'
);

select ok(
  (select prosecdef from pg_proc where oid = 'public.server_admin_set_game_visibility(uuid, uuid, text, boolean)'::regprocedure) = false
    and has_function_privilege('service_role', 'public.server_admin_set_game_visibility(uuid, uuid, text, boolean)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.server_admin_set_game_visibility(uuid, uuid, text, boolean)', 'EXECUTE'),
  'Admin : set_game_visibility est réservé au rôle serveur'
);

select ok(
  (select prosecdef from pg_proc where oid = 'public.server_admin_list_conversations(uuid)'::regprocedure) = false
    and has_function_privilege('service_role', 'public.server_admin_list_conversations(uuid)', 'EXECUTE'),
  'Admin : list_conversations est réservé au rôle serveur'
);

select ok(
  (select prosecdef from pg_proc where oid = 'public.server_admin_get_conversation(uuid, uuid, bigint, integer)'::regprocedure) = false
    and has_function_privilege('service_role', 'public.server_admin_get_conversation(uuid, uuid, bigint, integer)', 'EXECUTE'),
  'Admin : get_conversation est réservé au rôle serveur'
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
    '00000000-0000-4000-8000-00000000d101', 'authenticated', 'authenticated',
    'thfrancony@gmail.com', clock_timestamp(), '{}'::jsonb, '{}'::jsonb,
    clock_timestamp(), clock_timestamp(), false, false
  ),
  (
    '00000000-0000-4000-8000-00000000d102', 'authenticated', 'authenticated',
    'admin-alice@example.invalid', clock_timestamp(), '{}'::jsonb, '{}'::jsonb,
    clock_timestamp(), clock_timestamp(), false, false
  ),
  (
    '00000000-0000-4000-8000-00000000d103', 'authenticated', 'authenticated',
    'admin-bob@example.invalid', clock_timestamp(), '{}'::jsonb, '{}'::jsonb,
    clock_timestamp(), clock_timestamp(), false, false
  );

select ok(private.is_admin_account('00000000-0000-4000-8000-00000000d101'::uuid), 'Admin : l''e-mail autorisé est reconnu');
select ok(not private.is_admin_account('00000000-0000-4000-8000-00000000d102'::uuid), 'Admin : un autre e-mail est refusé');
select ok(public.server_is_admin('00000000-0000-4000-8000-00000000d101'::uuid), 'Admin : server_is_admin confirme le compte');

-- ---------------------------------------------------------------------------
-- Visibilité des jeux
-- ---------------------------------------------------------------------------

select is(
  jsonb_array_length(public.server_admin_list_games('00000000-0000-4000-8000-00000000d101'::uuid)),
  9,
  'Admin : la liste des jeux contient les neuf slugs'
);

select is(
  public.server_admin_set_game_visibility(
    '00000000-0000-4000-8000-00000000d101'::uuid,
    '00000000-0000-4000-8000-00000000d201'::uuid,
    'uno',
    false
  )->>'visible',
  'false',
  'Admin : l''administrateur masque un jeu'
);

select is(
  (select visible from public.games where slug = 'uno'),
  false,
  'Admin : le masquage est persistant en base'
);

select throws_ok(
  $q$ select public.server_admin_list_games('00000000-0000-4000-8000-00000000d102'::uuid) $q$,
  'P0001',
  'ADMIN_REQUIRED',
  'Admin : un membre normal ne liste pas les jeux'
);

select throws_ok(
  $q$
    select public.server_admin_set_game_visibility(
      '00000000-0000-4000-8000-00000000d102'::uuid,
      '00000000-0000-4000-8000-00000000d202'::uuid,
      'uno',
      true
    )
  $q$,
  'P0001',
  'ADMIN_REQUIRED',
  'Admin : un membre normal ne change pas la visibilité'
);

-- ---------------------------------------------------------------------------
-- Vue des discussions
-- ---------------------------------------------------------------------------

do $$
begin
  perform public.server_send_friend_request(
    '00000000-0000-4000-8000-00000000d102'::uuid,
    '00000000-0000-4000-8000-00000000d203'::uuid,
    '00000000-0000-4000-8000-00000000d103'::uuid
  );
  perform public.server_respond_friend_request(
    '00000000-0000-4000-8000-00000000d103'::uuid,
    '00000000-0000-4000-8000-00000000d204'::uuid,
    (select id from private.friendships where pair_low = '00000000-0000-4000-8000-00000000d102'::uuid),
    true
  );
  perform public.server_open_direct_conversation(
    '00000000-0000-4000-8000-00000000d102'::uuid,
    '00000000-0000-4000-8000-00000000d205'::uuid,
    '00000000-0000-4000-8000-00000000d103'::uuid
  );
  perform public.server_send_chat_message(
    '00000000-0000-4000-8000-00000000d102'::uuid,
    '00000000-0000-4000-8000-00000000d206'::uuid,
    (select id from private.chat_conversations where kind = 'direct'),
    'Message privé de test',
    null, null, null
  );
end;
$$;

select throws_ok(
  $q$ select public.server_admin_list_conversations('00000000-0000-4000-8000-00000000d102'::uuid) $q$,
  'P0001',
  'ADMIN_REQUIRED',
  'Admin : un membre normal ne liste pas les conversations'
);

select is(
  jsonb_array_length(public.server_admin_list_conversations('00000000-0000-4000-8000-00000000d101'::uuid)),
  2,
  'Admin : le général et la conversation privée sont visibles'
);

select is(
  jsonb_array_length(
    public.server_admin_get_conversation(
      '00000000-0000-4000-8000-00000000d101'::uuid,
      (select id from private.chat_conversations where kind = 'direct'),
      null::bigint,
      30
    )->'conversation'->'members'
  ),
  2,
  'Admin : les deux participants d''une conversation privée sont identifiés'
);

select is(
  jsonb_array_length(
    public.server_admin_get_conversation(
      '00000000-0000-4000-8000-00000000d101'::uuid,
      (select id from private.chat_conversations where kind = 'general'),
      null::bigint,
      30
    )->'conversation'->'members'
  ),
  0,
  'Admin : le chat général n''a pas de participants privés'
);

select throws_ok(
  $q$
    select public.server_admin_get_conversation(
      '00000000-0000-4000-8000-00000000d101'::uuid,
      '00000000-0000-4000-8000-00000000d2ff'::uuid,
      null::bigint,
      30
    )
  $q$,
  'P0001',
  'CONVERSATION_NOT_FOUND',
  'Admin : une conversation inconnue est refusée'
);

select * from finish();

rollback;
