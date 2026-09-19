create index if not exists adsets_unit_code_idx
  on public.adsets (unit_code);

create index if not exists google_campaigns_unit_code_idx
  on public.google_campaigns (unit_code);

alter function public.get_categorias_best_creatives(date, date)
  set search_path = public;

alter function public.get_comunidade_best_creatives(date, date)
  set search_path = public;

alter function public.get_top_creatives_by_reach(date, date, integer)
  set search_path = public;

create or replace function public.get_top_ads_by_reach(
  p_start date,
  p_end date,
  p_limit integer default 10,
  p_platform text default 'all'
)
returns table(
  creative_name text,
  creative_format text,
  ad_id text,
  campaign_name text,
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
      select 1
      from public.ad_insights_period p, requested r
      where p.period_start = p_start
        and p.period_end = p_end
        and p.platform_scope = r.scope
    ) as value
  ),
  period_metrics as (
    select p.ad_id, p.spend, p.impressions, p.reach, p.thruplay,
      p.page_engagement, p.profile_visits, p.comments, p.likes,
      p.video_avg_watch_time, true as exact_reach
    from public.ad_insights_period p, requested r, period_available available
    where available.value
      and p.period_start = p_start
      and p.period_end = p_end
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
    from public.ad_insights_daily i, requested r, period_available available
    where not available.value
      and i.date between p_start and p_end
      and (r.scope = 'all' or i.platform = r.scope)
    group by i.ad_id
  ),
  metrics as (
    select * from period_metrics
    union all
    select * from daily_metrics
  )
  select
    coalesce(a.creative_name, a.name) as creative_name,
    a.creative_format,
    a.id as ad_id,
    c.name as campaign_name,
    a.thumbnail_url,
    a.permalink_url,
    m.spend,
    m.impressions,
    m.reach,
    m.thruplay,
    m.page_engagement,
    m.profile_visits,
    m.comments,
    m.likes,
    m.video_avg_watch_time,
    r.scope as platform_scope,
    m.exact_reach as reach_is_period_unique,
    case when m.exact_reach then 'reach' else 'impressions' end as ranking_metric
  from metrics m
  join public.ads a on a.id = m.ad_id
  join public.campaigns c on c.id = a.campaign_id
  cross join requested r
  where a.platform = 'meta'
  order by
    case when m.exact_reach then m.reach else m.impressions end desc nulls last,
    (m.spend / nullif(case when m.exact_reach then m.reach else m.impressions end, 0)) asc nulls last,
    m.impressions desc nulls last,
    a.id asc
  limit greatest(1, least(coalesce(p_limit, 10), 100));
$$;

grant execute on function public.get_top_ads_by_reach(date, date, integer, text)
  to anon, authenticated;
