-- Skyjo uses the existing match/room JSON state contract; this migration only
-- makes the versioned game startable after the application code is deployed.
update public.games
set availability = 'ready', rules_version = 'skyjo-1'
where slug = 'skyjo';
