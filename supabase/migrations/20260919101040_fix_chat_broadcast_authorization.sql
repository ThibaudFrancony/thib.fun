-- Realtime vérifie les droits avec une ligne de sonde dont `private` est
-- false (valeur par défaut), même pour un abonnement privé. Ce champ ne doit
-- donc pas filtrer la sonde. Le canal reste privé côté client et émetteur.
-- On conserve l'identité, le topic exact, l'extension et l'admission active.
alter policy chat_broadcast_receive on realtime.messages
using (
  realtime.topic() = 'chat:' || (select auth.uid())::text
  and extension = 'broadcast'
  and topic = 'chat:' || (select auth.uid())::text
  and (select public.is_site_member())
);
