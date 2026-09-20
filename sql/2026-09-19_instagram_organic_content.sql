create table if not exists public.instagram_account_insights_daily (
  profile_id text not null,
  date date not null,
  metric text not null,
  value bigint not null default 0,
  synced_at timestamptz not null default now(),
  primary key (profile_id, date, metric)
);

create table if not exists public.instagram_account_insights_period (
  profile_id text not null,
  period_start date not null,
  period_end date not null,
  metric text not null,
  value bigint not null default 0,
  synced_at timestamptz not null default now(),
  primary key (profile_id, period_start, period_end, metric),
  constraint instagram_account_period_dates_check check (period_end >= period_start)
);

create table if not exists public.instagram_media_insights (
  media_id text primary key,
  profile_id text not null,
  caption text,
  media_type text not null,
  published_at timestamptz not null,
  permalink text,
  thumbnail_url text,
  media_url text,
  reach bigint,
  views bigint,
  likes bigint not null default 0,
  comments bigint not null default 0,
  saved bigint,
  shares bigint,
  total_interactions bigint,
  synced_at timestamptz not null default now()
);

create index if not exists instagram_account_daily_lookup_idx
  on public.instagram_account_insights_daily (profile_id, date, metric);
create index if not exists instagram_account_period_lookup_idx
  on public.instagram_account_insights_period (profile_id, period_start, period_end, metric);
create index if not exists instagram_media_published_idx
  on public.instagram_media_insights (profile_id, published_at desc);

alter table public.instagram_account_insights_daily enable row level security;
alter table public.instagram_account_insights_period enable row level security;
alter table public.instagram_media_insights enable row level security;

grant select on table public.instagram_account_insights_daily to anon, authenticated;
grant select on table public.instagram_account_insights_period to anon, authenticated;
grant select on table public.instagram_media_insights to anon, authenticated;
grant select, insert, update, delete on table public.instagram_account_insights_daily to service_role;
grant select, insert, update, delete on table public.instagram_account_insights_period to service_role;
grant select, insert, update, delete on table public.instagram_media_insights to service_role;
revoke insert, update, delete on table public.instagram_account_insights_daily from anon, authenticated;
revoke insert, update, delete on table public.instagram_account_insights_period from anon, authenticated;
revoke insert, update, delete on table public.instagram_media_insights from anon, authenticated;

drop policy if exists "Dashboard pode ler metricas organicas diarias do Instagram" on public.instagram_account_insights_daily;
create policy "Dashboard pode ler metricas organicas diarias do Instagram"
  on public.instagram_account_insights_daily for select to anon, authenticated using (true);

drop policy if exists "Dashboard pode ler metricas organicas por periodo do Instagram" on public.instagram_account_insights_period;
create policy "Dashboard pode ler metricas organicas por periodo do Instagram"
  on public.instagram_account_insights_period for select to anon, authenticated using (true);

drop policy if exists "Dashboard pode ler posts organicos do Instagram" on public.instagram_media_insights;
create policy "Dashboard pode ler posts organicos do Instagram"
  on public.instagram_media_insights for select to anon, authenticated using (true);

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'sync-economart-instagram-content-daily';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
end $$;

select cron.schedule(
  'sync-economart-instagram-content-daily',
  '25 9 * * *',
  $cron$
  select net.http_post(
    url := 'https://ygnmahqprqlvhedjvskf.supabase.co/functions/v1/sync-economart-instagram-content',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_sync_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $cron$
);
