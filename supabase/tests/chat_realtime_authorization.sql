begin;
select plan(6);

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
) values (
  '00000000-0000-4000-8000-00000000c701', 'authenticated', 'authenticated',
  'chat-realtime@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now(), false, false
);

-- Reproduit la sonde d'autorisation Realtime : private=false, même pour un
-- canal privé. Les lignes et l'utilisateur disparaissent au rollback.
insert into realtime.messages (topic, extension, private, event) values
  ('chat:00000000-0000-4000-8000-00000000c701', 'broadcast', false, 'authorization.test'),
  ('chat:00000000-0000-4000-8000-00000000c701', 'broadcast', true, 'authorization.test'),
  ('chat:00000000-0000-4000-8000-00000000c702', 'broadcast', false, 'authorization.test'),
  ('chat:00000000-0000-4000-8000-00000000c701', 'presence', false, 'authorization.test');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000c701', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000c701","role":"authenticated"}', true);
select set_config('realtime.topic', 'chat:00000000-0000-4000-8000-00000000c701', true);
set local role authenticated;
select is((select count(*)::int from realtime.messages where event = 'authorization.test'), 2,
  'Le membre reçoit son Broadcast et passe la sonde ; Presence et le tiers sont exclus');
select throws_ok($q$insert into realtime.messages(topic,extension,private) values
  ('chat:00000000-0000-4000-8000-00000000c701','broadcast',true)$q$,
  '42501', null, 'Le client ne peut pas émettre des invalidations');

select set_config('realtime.topic', 'chat:00000000-0000-4000-8000-00000000c702', true);
select is((select count(*)::int from realtime.messages where event = 'authorization.test'), 0,
  'Le membre ne peut pas rejoindre le canal du tiers');
select set_config('realtime.topic', 'chat:00000000-0000-4000-8000-00000000c701', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000c702', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000c702","role":"authenticated"}', true);
select is((select count(*)::int from realtime.messages where event = 'authorization.test'), 0,
  'Le tiers ne peut pas lire le canal du membre');

reset role;
update private.site_members set status = 'disabled' where user_id = '00000000-0000-4000-8000-00000000c701';
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000c701', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000c701","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from realtime.messages where event = 'authorization.test'), 0,
  'Un membre désactivé ne reçoit pas les messages');
reset role;
select ok(not exists(select 1 from pg_policies where schemaname='realtime'
  and policyname='chat_broadcast_receive' and ('anon' = any(roles) or 'public' = any(roles))),
  'La politique ne donne pas accès aux visiteurs sans session');
select * from finish();
rollback;
