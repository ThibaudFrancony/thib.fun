-- tibo.fun — le rôle serveur peut exécuter les fonctions des triggers profil.
--
-- Correctif : les triggers profiles_enforce_names et
-- match_players_normalize_snapshot appellent private.profile_display_key,
-- private.pseudo_key et leurs fonctions trigger. Les écritures API passent
-- par PostgREST en service_role, qui n'avait pas EXECUTE (privilèges par
-- défaut révoqués dans private) → 42501, mappé en 503 côté API.

grant execute on function private.profile_display_key(text) to service_role;
grant execute on function private.pseudo_key(text) to service_role;
grant execute on function private.enforce_profile_names() to service_role;
grant execute on function private.normalize_match_player_snapshot() to service_role;
