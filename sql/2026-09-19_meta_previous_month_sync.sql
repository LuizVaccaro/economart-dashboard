do $$
declare existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'sync-economart-meta-previous-month-daily';

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end $$;

select cron.schedule(
  'sync-economart-meta-previous-month-daily',
  '40 9 * * *',
  $cron$
  select net.http_post(
    url := 'https://ygnmahqprqlvhedjvskf.supabase.co/functions/v1/sync-economart-meta-period-insights'
      || '?since=' || to_char((date_trunc('month', current_date) - interval '1 month')::date, 'YYYY-MM-DD')
      || '&until=' || to_char((date_trunc('month', current_date) - interval '1 day')::date, 'YYYY-MM-DD'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'cron_sync_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $cron$
);
