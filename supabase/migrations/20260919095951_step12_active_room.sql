-- tibo.fun — Étape 12 : salle active du membre, quel que soit le jeu.
--
-- Correctif de découverte : `server_get_active_lobby` (Étape 11) ne reconnaît
-- que les salons génériques (`game_slug is null`). Dès qu'un jeu était posé
-- (préparation, tentative de lancement, salon créé depuis une page de jeu), le
-- membre ne voyait plus son propre groupe alors que l'autre joueur le voyait
-- toujours via `server_get_room`. La présente fonction expose, avec la même
-- projection que `server_get_room`, le salon actif le plus récent du membre :
-- en attente ou en cours, avec ou sans jeu choisi.
--
-- Entièrement additif : `server_get_active_lobby` reste la fonction des salons
-- génériques utilisée par `server_create_lobby` (réutilisation d'un salon
-- d'accueil existant). Aucune migration déjà appliquée n'est réécrite.

create or replace function public.server_get_active_room(p_actor uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select rv.payload || jsonb_build_object(
    'viewerId', p_actor,
    'hostId', r.host_id,
    'expiresAt', r.expires_at
  )
  from public.room_views rv
  join private.rooms r on r.id = rv.room_id
  join private.room_members rm on rm.room_id = rv.room_id and rm.user_id = rv.viewer_id
  join private.site_members sm on sm.user_id = rv.viewer_id and sm.status = 'active'
  where rv.viewer_id = p_actor
    and r.status in ('waiting', 'playing')
    and r.expires_at > clock_timestamp()
  order by r.updated_at desc
  limit 1;
$$;

revoke all on function public.server_get_active_room(uuid) from public, anon, authenticated;
grant execute on function public.server_get_active_room(uuid) to service_role;
