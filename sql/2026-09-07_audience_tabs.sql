alter table public.tiktok_audience_insights
  drop constraint if exists tiktok_audience_dimension_check;

alter table public.tiktok_audience_insights
  add constraint tiktok_audience_dimension_check
  check (dimension in ('interest_category','age','gender','province'));

create table if not exists public.meta_audience_insights (
  advertiser_id text not null,
  period_start date not null,
  period_end date not null,
  platform text not null default 'meta',
  dimension text not null,
  dimension_value text not null,
  dimension_name text not null,
  reach bigint not null default 0,
  impressions bigint not null default 0,
  synced_at timestamptz not null default now(),
  primary key (advertiser_id, period_start, period_end, platform, dimension, dimension_value),
  constraint meta_audience_period_check check (period_end >= period_start),
  constraint meta_audience_platform_check check (platform in ('meta','facebook','instagram')),
  constraint meta_audience_dimension_check check (dimension in ('age_gender','region','platform_total'))
);

alter table public.meta_audience_insights enable row level security;
grant select on table public.meta_audience_insights to anon, authenticated;
revoke insert, update, delete on table public.meta_audience_insights from anon, authenticated;

drop policy if exists "Dashboard pode ler audiencia Meta" on public.meta_audience_insights;
create policy "Dashboard pode ler audiencia Meta"
  on public.meta_audience_insights for select to anon, authenticated
  using (advertiser_id = '103801426');

create index if not exists meta_audience_insights_latest_idx
  on public.meta_audience_insights (advertiser_id, period_end desc, platform, dimension);

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'sync-economart-meta-audience-daily';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
end $$;

select cron.schedule(
  'sync-economart-meta-audience-daily',
  '15 9 * * *',
  $$
  select net.http_post(
    url := 'https://ygnmahqprqlvhedjvskf.supabase.co/functions/v1/sync-economart-meta-audience',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_sync_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
