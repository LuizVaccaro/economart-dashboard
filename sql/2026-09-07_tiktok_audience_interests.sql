begin;

create table if not exists public.tiktok_audience_insights (
  advertiser_id text not null,
  period_start date not null,
  period_end date not null,
  data_level text not null default 'AUCTION_ADVERTISER',
  entity_id text not null default '',
  dimension text not null,
  dimension_value text not null,
  dimension_value_v2 text,
  dimension_name text not null,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  spend numeric not null default 0,
  reach bigint not null default 0,
  synced_at timestamptz not null default now(),
  primary key (
    advertiser_id, period_start, period_end, data_level,
    entity_id, dimension, dimension_value
  ),
  constraint tiktok_audience_period_check check (period_end >= period_start),
  constraint tiktok_audience_dimension_check check (dimension in ('interest_category'))
);

alter table public.tiktok_audience_insights enable row level security;

drop policy if exists "Dashboard pode ler audiencia TikTok" on public.tiktok_audience_insights;
create policy "Dashboard pode ler audiencia TikTok"
on public.tiktok_audience_insights
for select
to anon, authenticated
using (true);

grant select on public.tiktok_audience_insights to anon, authenticated;

comment on table public.tiktok_audience_insights is
  'Snapshots de relatorios AUDIENCE do TikTok. Categorias se sobrepoem e nao devem ser somadas.';
comment on column public.tiktok_audience_insights.reach is
  'Mantido para auditoria; interest_category retornou zero. O dashboard usa impressions.';

commit;
