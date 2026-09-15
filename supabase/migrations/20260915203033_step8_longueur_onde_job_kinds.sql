-- The shared commit RPC predates Longueur d'onde and must accept its two
-- phase-deadline jobs. Rebuild the current function definition in place from
-- the database, changing only the allow-lists; no applied migration is edited.
do $step8$
declare
  definition text;
begin
  select pg_get_functiondef(p.oid)
  into definition
  from pg_proc p
  where p.oid = 'public.server_commit_match(jsonb)'::regprocedure;

  if definition is null then
    raise exception 'SERVER_COMMIT_MATCH_MISSING';
  end if;

  if position('''clue_timeout''' in definition) = 0 or position('''guess_timeout''' in definition) = 0 then
    definition := replace(
      definition,
      '''contest_timeout''',
      '''contest_timeout'', ''clue_timeout'', ''guess_timeout'''
    );
  end if;

  if position('''clue_timeout''' in definition) = 0 or position('''guess_timeout''' in definition) = 0 then
    raise exception 'SERVER_COMMIT_MATCH_JOB_ALLOWLIST_UNEXPECTED';
  end if;

  execute definition;
end
$step8$;
