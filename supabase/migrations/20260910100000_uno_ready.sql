-- UNO uses the existing match/room JSON state contract; this migration only
-- makes the versioned game startable after the application code is deployed.
update public.games
set availability = 'ready', rules_version = 'uno-1'
where slug = 'uno';
