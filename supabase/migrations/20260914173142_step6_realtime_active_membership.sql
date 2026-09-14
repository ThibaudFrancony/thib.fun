-- Étape 6 : un compte désactivé ne doit plus pouvoir rejoindre le canal
-- Broadcast privé qui invalide les salons et parties. Cette migration est
-- additive : elle ne réécrit aucune migration déjà appliquée.
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
  and (select public.is_site_member())
);
