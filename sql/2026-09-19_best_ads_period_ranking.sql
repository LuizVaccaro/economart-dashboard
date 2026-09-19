create table if not exists public.ad_insights_period (
  ad_id text not null references public.ads(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  platform_scope text not null,
  spend numeric not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  reach bigint not null default 0,
  frequency numeric,
  cpc numeric,
  cpm numeric,
  ctr numeric,
  video_avg_watch_time numeric,
  thruplay bigint,
  page_engagement bigint,
  profile_visits bigint,
  comments bigint,
  likes bigint,
  synced_at timestamptz not null default now(),
  primary key (ad_id, period_start, period_end, platform_scope),
  constraint ad_insights_period_dates_check check (period_end >= period_start),
  constraint ad_insights_period_platform_check check (platform_scope in ('all', 'facebook', 'instagram'))
);

create index if not exists ad_insights_period_lookup_idx
  on public.ad_insights_period (period_start, period_end, platform_scope, ad_id);

alter table public.ad_insights_period enable row level security;
grant select on table public.ad_insights_period to anon, authenticated;
grant select, insert, update, delete on table public.ad_insights_period to service_role;
revoke insert, update, delete on table public.ad_insights_period from anon, authenticated;

drop policy if exists "Dashboard pode ler insights Meta por periodo" on public.ad_insights_period;
create policy "Dashboard pode ler insights Meta por periodo"
  on public.ad_insights_period for select to anon, authenticated
  using (true);

create or replace function public.get_categorias_best_ads(
  p_start date,
  p_end date,
  p_platform text default 'all'
)
returns table(
  category text,
  state text,
  objective_key text,
  creative_name text,
  creative_format text,
  ad_id text,
  thumbnail_url text,
  permalink_url text,
  spend numeric,
  impressions bigint,
  reach bigint,
  thruplay bigint,
  page_engagement bigint,
  profile_visits bigint,
  comments bigint,
  likes bigint,
  video_avg_watch_time numeric,
  platform_scope text,
  reach_is_period_unique boolean,
  ranking_metric text
)
language sql
stable
security invoker
set search_path = public
as $$
  with requested as (
    select case when p_platform in ('all', 'facebook', 'instagram') then p_platform else 'all' end as scope
  ),
  period_available as (
    select exists (
      select 1 from public.ad_insights_period p, requested r
      where p.period_start = p_start and p.period_end = p_end and p.platform_scope = r.scope
    ) as value
  ),
  period_metrics as (
    select p.ad_id, p.spend, p.impressions, p.reach, p.thruplay,
      p.page_engagement, p.profile_visits, p.comments, p.likes,
      p.video_avg_watch_time, true as exact_reach
    from public.ad_insights_period p, requested r, period_available a
    where a.value and p.period_start = p_start and p.period_end = p_end
      and p.platform_scope = r.scope
  ),
  daily_metrics as (
    select i.ad_id,
      sum(i.spend) as spend,
      sum(i.impressions)::bigint as impressions,
      null::bigint as reach,
      sum(i.thruplay)::bigint as thruplay,
      sum(i.page_engagement)::bigint as page_engagement,
      sum(i.profile_visits)::bigint as profile_visits,
      sum(i.comments)::bigint as comments,
      sum(i.likes)::bigint as likes,
      avg(i.video_avg_watch_time) as video_avg_watch_time,
      false as exact_reach
    from public.ad_insights_daily i, requested r, period_available a
    where not a.value and i.date between p_start and p_end
      and (r.scope = 'all' or i.platform = r.scope)
    group by i.ad_id
  ),
  metrics as (
    select * from period_metrics
    union all
    select * from daily_metrics
  ),
  candidates as (
    select s.category, s.state, c.objective_key,
      coalesce(a.creative_name, a.name) as creative_name,
      a.creative_format, a.id as ad_id, a.thumbnail_url, a.permalink_url,
      m.spend, m.impressions, m.reach, m.thruplay, m.page_engagement,
      m.profile_visits, m.comments, m.likes, m.video_avg_watch_time,
      m.exact_reach, r.scope as platform_scope,
      case when c.objective_key = 'alcance' and not m.exact_reach then 'impressions' else c.objective_key end as ranking_metric,
      case when c.objective_key = 'alcance'
        then case when m.exact_reach then m.reach else m.impressions end
        else m.profile_visits
      end as primary_value
    from metrics m
    join public.ads a on a.id = m.ad_id
    join public.adsets s on s.id = a.adset_id
    join public.campaigns c on c.id = a.campaign_id
    cross join requested r
    where c.campaign_group = 'categorias'
      and s.category is not null and s.state is not null and c.objective_key is not null
  ),
  ranked as (
    select candidates.*,
      row_number() over (
        partition by category, state, objective_key
        order by primary_value desc nulls last,
          (spend / nullif(primary_value, 0)) asc nulls last,
          impressions desc nulls last,
          ad_id asc
      ) as rn
    from candidates
  )
  select category, state, objective_key, creative_name, creative_format, ad_id,
    thumbnail_url, permalink_url, spend, impressions, reach, thruplay,
    page_engagement, profile_visits, comments, likes, video_avg_watch_time,
    platform_scope, exact_reach, ranking_metric
  from ranked
  where rn = 1;
$$;

create or replace function public.get_comunidade_best_ads(
  p_start date,
  p_end date,
  p_platform text default 'all'
)
returns table(
  community_region text,
  creative_name text,
  creative_format text,
  ad_id text,
  thumbnail_url text,
  permalink_url text,
  spend numeric,
  impressions bigint,
  reach bigint,
  thruplay bigint,
  page_engagement bigint,
  profile_visits bigint,
  comments bigint,
  likes bigint,
  video_avg_watch_time numeric,
  platform_scope text,
  reach_is_period_unique boolean,
  ranking_metric text
)
language sql
stable
security invoker
set search_path = public
as $$
  with requested as (
    select case when p_platform in ('all', 'facebook', 'instagram') then p_platform else 'all' end as scope
  ),
  period_available as (
    select exists (
      select 1 from public.ad_insights_period p, requested r
      where p.period_start = p_start and p.period_end = p_end and p.platform_scope = r.scope
    ) as value
  ),
  period_metrics as (
    select p.ad_id, p.spend, p.impressions, p.reach, p.thruplay,
      p.page_engagement, p.profile_visits, p.comments, p.likes,
      p.video_avg_watch_time, true as exact_reach
    from public.ad_insights_period p, requested r, period_available a
    where a.value and p.period_start = p_start and p.period_end = p_end
      and p.platform_scope = r.scope
  ),
  daily_metrics as (
    select i.ad_id,
      sum(i.spend) as spend,
      sum(i.impressions)::bigint as impressions,
      null::bigint as reach,
      sum(i.thruplay)::bigint as thruplay,
      sum(i.page_engagement)::bigint as page_engagement,
      sum(i.profile_visits)::bigint as profile_visits,
      sum(i.comments)::bigint as comments,
      sum(i.likes)::bigint as likes,
      avg(i.video_avg_watch_time) as video_avg_watch_time,
      false as exact_reach
    from public.ad_insights_daily i, requested r, period_available a
    where not a.value and i.date between p_start and p_end
      and (r.scope = 'all' or i.platform = r.scope)
    group by i.ad_id
  ),
  metrics as (
    select * from period_metrics
    union all
    select * from daily_metrics
  ),
  candidates as (
    select s.community_region,
      coalesce(a.creative_name, a.name) as creative_name,
      a.creative_format, a.id as ad_id, a.thumbnail_url, a.permalink_url,
      m.spend, m.impressions, m.reach, m.thruplay, m.page_engagement,
      m.profile_visits, m.comments, m.likes, m.video_avg_watch_time,
      m.exact_reach, r.scope as platform_scope,
      m.profile_visits as primary_value
    from metrics m
    join public.ads a on a.id = m.ad_id
    join public.adsets s on s.id = a.adset_id
    join public.campaigns c on c.id = a.campaign_id
    cross join requested r
    where c.campaign_group = 'comunidade' and s.community_region is not null
  ),
  ranked as (
    select candidates.*,
      row_number() over (
        partition by community_region
        order by primary_value desc nulls last,
          (spend / nullif(primary_value, 0)) asc nulls last,
          reach desc nulls last,
          impressions desc nulls last,
          ad_id asc
      ) as rn
    from candidates
  )
  select community_region, creative_name, creative_format, ad_id,
    thumbnail_url, permalink_url, spend, impressions, reach, thruplay,
    page_engagement, profile_visits, comments, likes, video_avg_watch_time,
    platform_scope, exact_reach, 'ig_profile'::text as ranking_metric
  from ranked
  where rn = 1;
$$;

grant execute on function public.get_categorias_best_ads(date, date, text) to anon, authenticated;
grant execute on function public.get_comunidade_best_ads(date, date, text) to anon, authenticated;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'sync-economart-meta-period-insights-daily';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
end $$;

select cron.schedule(
  'sync-economart-meta-period-insights-daily',
  '30 9 * * *',
  $$
  select net.http_post(
    url := 'https://ygnmahqprqlvhedjvskf.supabase.co/functions/v1/sync-economart-meta-period-insights',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_sync_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);
