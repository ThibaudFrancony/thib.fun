-- tibo.fun — le rôle serveur peut modifier les profils via l'API.
--
-- Correctif : les routes /profil (nom affiché, preset, nom de création,
-- avatar) écrivent public.profiles avec la clé serveur, mais service_role
-- n'y avait que SELECT (contrat docs/02 §7 : « ce rôle reçoit les droits
-- nécessaires »). Sans UPDATE, toute sauvegarde profil répond 503
-- DATABASE_UNAVAILABLE. Idempotent : sans effet si déjà accordé.

grant update on table public.profiles to service_role;
