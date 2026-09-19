-- Realtime verifie les droits avec une ligne de sonde dont `private` est
-- false (valeur par defaut), meme pour un abonnement prive. Ce champ ne doit
-- donc pas filtrer la sonde : c'etait la cause des erreurs massives
-- "Unauthorized: You do not have permissions to read from this Channel topic:
-- user:<uid>" alors meme que le JWT, le topic et l'admission etaient valides.
-- Meme correctif que `chat_broadcast_receive` (20260919101040). Le canal reste
-- prive cote client et emetteur. On conserve l'identite, le topic exact,
-- l'extension Broadcast et l'admission active.
alter policy user_broadcast_receive on realtime.messages
using (
  realtime.topic() = 'user:' || (select auth.uid())::text
  and extension = 'broadcast'
  and topic = 'user:' || (select auth.uid())::text
  and (select public.is_site_member())
);
