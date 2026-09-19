create table if not exists public.organic_audience_insights (
  source text not null,
  profile_id text not null,
  username text not null,
  snapshot_date date not null,
  dimension text not null,
  dimension_value text not null,
  dimension_name text not null,
  value bigint not null default 0,
  followers_count bigint not null default 0,
  synced_at timestamptz not null default now(),
  primary key (source, profile_id, snapshot_date, dimension, dimension_value),
  constraint organic_audience_source_check check (source in ('instagram', 'facebook'))
);

create index if not exists organic_audience_latest_idx
  on public.organic_audience_insights (source, profile_id, snapshot_date desc, dimension);

alter table public.organic_audience_insights enable row level security;
grant select on table public.organic_audience_insights to anon, authenticated;
grant select, insert, update, delete on table public.organic_audience_insights to service_role;
revoke insert, update, delete on table public.organic_audience_insights from anon, authenticated;

drop policy if exists "Dashboard pode ler publico organico do Instagram"
  on public.organic_audience_insights;
create policy "Dashboard pode ler publico organico do Instagram"
  on public.organic_audience_insights for select to anon, authenticated
  using (true);

do $$
declare existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'sync-economart-instagram-audience-daily';

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end $$;

select cron.schedule(
  'sync-economart-instagram-audience-daily',
  '20 9 * * *',
  $cron$
  select net.http_post(
    url := 'https://ygnmahqprqlvhedjvskf.supabase.co/functions/v1/sync-economart-instagram-audience',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'cron_sync_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $cron$
);
