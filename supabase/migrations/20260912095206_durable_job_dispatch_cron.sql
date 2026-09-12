-- tibo.fun — durable job wake-up for match deadlines
-- The dispatcher reads worker_origin and internal_job_secret from Vault.
-- No secret or production URL is stored in this migration.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $migration$
declare
  v_job record;
begin
  -- Keep one canonical dispatcher even if a previous dashboard/manual job exists.
  for v_job in
    select jobid
    from cron.job
    where command like '%private.dispatch_due_jobs%'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;

  perform cron.schedule(
    'tibo-fun-dispatch-due-jobs',
    '1 second',
    $job$select private.dispatch_due_jobs();$job$
  );
end;
$migration$;
