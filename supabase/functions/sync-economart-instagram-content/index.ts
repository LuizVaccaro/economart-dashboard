import { createClient } from "jsr:@supabase/supabase-js@2";

const TOKEN = Deno.env.get("META_ACCESS_TOKEN");
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const GRAPH_VERSION = "v21.0";
const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type Period = { since: string; until: string };

function localDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthStart(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function previousMonth(value: string): Period {
  const first = new Date(`${monthStart(value)}T12:00:00Z`);
  first.setUTCMonth(first.getUTCMonth() - 1);
  const since = first.toISOString().slice(0, 10);
  const last = new Date(`${monthStart(value)}T12:00:00Z`);
  last.setUTCDate(last.getUTCDate() - 1);
  return { since, until: last.toISOString().slice(0, 10) };
}

function standardPeriods(today: string): Period[] {
  const yesterday = addDays(today, -1);
  const values = [
    { since: today, until: today },
    { since: yesterday, until: yesterday },
    { since: addDays(yesterday, -6), until: yesterday },
    { since: addDays(yesterday, -13), until: yesterday },
    { since: addDays(yesterday, -29), until: yesterday },
    { since: monthStart(today), until: yesterday },
    previousMonth(today),
  ].filter((period) => {
    const days = (new Date(`${period.until}T12:00:00Z`).getTime() - new Date(`${period.since}T12:00:00Z`).getTime()) / 86400000 + 1;
    return period.since <= period.until && days <= 30;
  });
  return [...new Map(values.map((period) => [`${period.since}|${period.until}`, period])).values()];
}

async function graph(path: string, params: Record<string, string>, accessToken: string) {
  const query = new URLSearchParams({ ...params, access_token: accessToken });
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}?${query}`);
  const json = await response.json();
  if (!response.ok) throw new Error(`Meta ${path}: ${JSON.stringify(json.error ?? json)}`);
  return json;
}

async function graphAll(path: string, params: Record<string, string>, accessToken: string) {
  const firstQuery = new URLSearchParams({ ...params, access_token: accessToken });
  let next: string | null = `https://graph.facebook.com/${GRAPH_VERSION}/${path}?${firstQuery}`;
  const rows: any[] = [];
  while (next) {
    const response = await fetch(next);
    const json = await response.json();
    if (!response.ok) throw new Error(`Meta ${path}: ${JSON.stringify(json.error ?? json)}`);
    rows.push(...(json.data ?? []));
    next = json.paging?.next ?? null;
  }
  return rows;
}

function metricValue(rows: any[], name: string) {
  const metric = rows.find((item) => item.name === name);
  return Number(metric?.total_value?.value ?? metric?.values?.[0]?.value ?? 0);
}

async function upsert(table: string, rows: any[], conflict: string) {
  for (let index = 0; index < rows.length; index += 500) {
    const { error } = await db.from(table).upsert(rows.slice(index, index + 500), { onConflict: conflict });
    if (error) throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (!CRON_SECRET) return Response.json({ error: "CRON_SECRET secret not set" }, { status: 500 });
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!TOKEN) return Response.json({ error: "META_ACCESS_TOKEN secret not set" }, { status: 500 });

  try {
    const accounts = await graph("me/accounts", {
      fields: "id,access_token,instagram_business_account{id,username}", limit: "100",
    }, TOKEN);
    const page = (accounts.data ?? []).find((item: any) => item.instagram_business_account?.username === "economartbr")
      ?? (accounts.data ?? []).find((item: any) => item.instagram_business_account?.id);
    if (!page?.instagram_business_account?.id || !page.access_token) {
      throw new Error("Conta profissional do Instagram não encontrada");
    }
    const profileId = page.instagram_business_account.id;
    const pageToken = page.access_token;
    const today = localDate();
    const periods = standardPeriods(today);
    const periodMetrics = ["reach", "views", "total_interactions", "website_clicks", "profile_views"];
    const syncedAt = new Date().toISOString();

    const periodRows = (await Promise.all(periods.map(async (period) => {
      const report = await graph(`${profileId}/insights`, {
        metric: periodMetrics.join(","), period: "day", metric_type: "total_value",
        since: period.since, until: addDays(period.until, 1),
      }, pageToken);
      return periodMetrics.map((metric) => ({
        profile_id: profileId, period_start: period.since, period_end: period.until,
        metric, value: metricValue(report.data ?? [], metric), synced_at: syncedAt,
      }));
    }))).flat();

    const reachSince = addDays(today, -90);
    const historyEnd = addDays(today, -1);
    const reachWindows: Period[] = [];
    for (let since = reachSince; since <= historyEnd; since = addDays(since, 30)) {
      reachWindows.push({ since, until: [addDays(since, 29), historyEnd].sort()[0] });
    }
    const reachReports = await Promise.all(reachWindows.map((period) =>
      graph(`${profileId}/insights`, {
        metric: "reach", period: "day", metric_type: "time_series",
        since: period.since, until: addDays(period.until, 1),
      }, pageToken)
    ));
    const followerReport = await graph(`${profileId}/insights`, {
      metric: "follower_count", period: "day", metric_type: "time_series",
      since: addDays(today, -30), until: today,
    }, pageToken);
    const dailyRows = [...reachReports, followerReport].flatMap((daily) =>
      (daily.data ?? []).flatMap((metric: any) =>
        (metric.values ?? []).map((item: any) => ({
          profile_id: profileId,
          date: addDays(String(item.end_time).slice(0, 10), -1),
          metric: metric.name,
          value: Number(item.value ?? 0),
          synced_at: syncedAt,
        }))
      )
    );

    const mediaSince = addDays(today, -93);
    const media = await graphAll(`${profileId}/media`, {
      fields: "id,caption,media_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count,insights.metric(reach,saved,shares,total_interactions,views)",
      since: mediaSince,
      until: today,
      limit: "100",
    }, pageToken);
    const mediaRows = media.map((item: any) => {
      const insights = item.insights?.data ?? [];
      return {
        media_id: item.id,
        profile_id: profileId,
        caption: item.caption ?? null,
        media_type: item.media_type ?? "UNKNOWN",
        published_at: item.timestamp,
        permalink: item.permalink ?? null,
        thumbnail_url: item.thumbnail_url ?? null,
        media_url: item.media_url ?? null,
        reach: metricValue(insights, "reach"),
        views: metricValue(insights, "views"),
        likes: Number(item.like_count ?? 0),
        comments: Number(item.comments_count ?? 0),
        saved: metricValue(insights, "saved"),
        shares: metricValue(insights, "shares"),
        total_interactions: metricValue(insights, "total_interactions"),
        synced_at: syncedAt,
      };
    });

    const { error: cleanupError } = await db.from("instagram_account_insights_daily")
      .delete().eq("profile_id", profileId).in("metric", ["reach", "follower_count"])
      .gte("date", reachSince).lte("date", today);
    if (cleanupError) throw cleanupError;
    const { error: periodCleanupError } = await db.from("instagram_account_insights_period")
      .delete().eq("profile_id", profileId);
    if (periodCleanupError) throw periodCleanupError;

    await upsert("instagram_account_insights_period", periodRows, "profile_id,period_start,period_end,metric");
    await upsert("instagram_account_insights_daily", dailyRows, "profile_id,date,metric");
    await upsert("instagram_media_insights", mediaRows, "media_id");

    return Response.json({
      profile_id: profileId,
      periods: periods.length,
      period_rows: periodRows.length,
      daily_rows: dailyRows.length,
      media_rows: mediaRows.length,
      synced_at: syncedAt,
    });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 502 });
  }
});
