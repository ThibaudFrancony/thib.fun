-- tibo.fun — console d'administration : correctif de privilège.
--
-- Cause : `20260919093337_admin_console` révoque `EXECUTE` sur
-- `private.is_admin_account(uuid)` à `public, anon, authenticated` sans
-- l'accorder à `service_role`. Or toutes les RPC `public.server_admin_*` et
-- `public.server_is_admin` sont `SECURITY INVOKER` et appellent
-- `private.is_admin_account` directement : exécutées via le rôle serveur
-- (seul rôle autorisé sur ces RPC), elles échouaient avec
-- `42501 permission denied for function is_admin_account`, ce que
-- l'application mappe en `ADMIN_REQUIRED` / redirection vers `/`.
-- En SQL direct (rôle postgres), le contrôle semblait pourtant vrai.
--
-- Correctif strictement additif : accorder `EXECUTE` au seul `service_role`.
-- Aucune fonction redéfinie, aucune donnée modifiée, posture RLS inchangée
-- (toujours refusé à `anon`/`authenticated`/`public`).

grant execute on function private.is_admin_account(uuid) to service_role;
