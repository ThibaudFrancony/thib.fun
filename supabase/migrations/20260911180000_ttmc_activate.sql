-- tibo.fun — activation TTMC À ton niveau après pack + RPC.
-- Migration additive et idempotente : aucun contenu modifié, aucun DROP.
update public.games
set availability = 'ready', rules_version = 'ttmc-1'
where slug = 'ttmc';
