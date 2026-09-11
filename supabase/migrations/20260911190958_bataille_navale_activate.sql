-- Bataille navale uses the existing match/room JSON state contract; this migration
-- only makes the versioned game startable after the application code is
-- deployed. No board corpus is needed: the ship catalog is a server constant.
update public.games
set availability = 'ready', rules_version = 'bataille-navale-1'
where slug = 'bataille-navale';
