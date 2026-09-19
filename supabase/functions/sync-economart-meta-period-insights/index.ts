import { createClient } from "jsr:@supabase/supabase-js@2";

const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");
const AD_ACCOUNT_ID = Deno.env.get("META_AD_ACCOUNT_ID") ?? "103801426";
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const GRAPH_VERSION = "v21.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const INSIGHT_FIELDS = [
  "ad_id",
  "spend",
  "impressions",
  "clicks",
  "reach",
  "frequency",
  "cpc",
  "cpm",
  "ctr",
  "actions",
  "video_avg_time_watched_actions",
  "video_thruplay_watched_actions",
].join(",");

type Period = { since: string; until: string };

function localDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
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

function standardPeriods(today: string): Period[] {
  const yesterday = addDays(today, -1);
  const values = [
    { since: today, until: today },
    { since: yesterday, until: yesterday },
    { since: addDays(yesterday, -6), until: yesterday },
    { since: addDays(yesterday, -13), until: yesterday },
    { since: addDays(yesterday, -29), until: yesterday },
    { since: monthStart(today), until: yesterday },
  ].filter((period) => period.since <= period.until);

  return [...new Map(values.map((period) => [`${period.since}|${period.until}`, period])).values()];
}

function isDate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime());
}

function extractActionValue(actions: any[] | undefined, actionType: string) {
  const found = actions?.find((action) => action.action_type === actionType);
  return found ? Number(found.value) : null;
}

function extractFirstValue(actions: any[] | undefined) {
  return actions?.length ? Number(actions[0].value) : null;
}

async function fetchAllPages(url: string) {
  const rows: any[] = [];
  let next: string | null = url;
  while (next) {
    const response = await fetch(next);
    if (!response.ok) {
      throw new Error(`Graph API ${response.status}: ${await response.text()}`);
    }
    const json = await response.json();
    rows.push(...(json.data ?? []));
    next = json.paging?.next ?? null;
  }
  return rows;
}

async function fetchPeriod(period: Period, breakdown: boolean) {
  const params = new URLSearchParams({
    level: "ad",
    limit: "500",
    time_range: JSON.stringify(period),
    fields: INSIGHT_FIELDS,
    access_token: META_ACCESS_TOKEN ?? "",
  });
  if (breakdown) params.set("breakdowns", "publisher_platform");

  return fetchAllPages(
    `https://graph.facebook.com/${GRAPH_VERSION}/act_${AD_ACCOUNT_ID}/insights?${params}`,
  );
}

function toPeriodRow(row: any, period: Period, platformScope: string) {
  return {
    ad_id: row.ad_id,
    period_start: period.since,
    period_end: period.until,
    platform_scope: platformScope,
    spend: Number(row.spend ?? 0),
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    reach: Number(row.reach ?? 0),
    frequency: row.frequency ? Number(row.frequency) : null,
    cpc: row.cpc ? Number(row.cpc) : null,
    cpm: row.cpm ? Number(row.cpm) : null,
    ctr: row.ctr ? Number(row.ctr) : null,
    video_avg_watch_time: extractFirstValue(row.video_avg_time_watched_actions),
    thruplay: extractFirstValue(row.video_thruplay_watched_actions),
    page_engagement: extractActionValue(row.actions, "page_engagement"),
    profile_visits: extractActionValue(row.actions, "link_click"),
    comments: extractActionValue(row.actions, "comment"),
    likes: extractActionValue(row.actions, "like"),
    synced_at: new Date().toISOString(),
  };
}

async function upsertInChunks(rows: any[]) {
  for (let index = 0; index < rows.length; index += 500) {
    const batch = rows.slice(index, index + 500);
    const { error } = await supabase.from("ad_insights_period").upsert(batch, {
      onConflict: "ad_id,period_start,period_end,platform_scope",
    });
    if (error) throw error;
  }
}

Deno.serve(async (req) => {
  if (!CRON_SECRET) {
    return Response.json({ error: "CRON_SECRET secret not set" }, { status: 500 });
  }
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!META_ACCESS_TOKEN) {
    return Response.json({ error: "META_ACCESS_TOKEN secret not set" }, { status: 500 });
  }

  const url = new URL(req.url);
  const requestedSince = url.searchParams.get("since");
  const requestedUntil = url.searchParams.get("until");
  let periods: Period[];

  if (requestedSince !== null || requestedUntil !== null) {
    if (!isDate(requestedSince) || !isDate(requestedUntil) || requestedSince > requestedUntil) {
      return Response.json({ error: "Invalid since/until range" }, { status: 400 });
    }
    const days = Math.round(
      (new Date(`${requestedUntil}T12:00:00Z`).getTime() -
        new Date(`${requestedSince}T12:00:00Z`).getTime()) / 86400000,
    ) + 1;
    if (days > 93) {
      return Response.json({ error: "Maximum period is 93 days" }, { status: 400 });
    }
    periods = [{ since: requestedSince, until: requestedUntil }];
  } else {
    periods = standardPeriods(localDate());
  }

  const summaries: any[] = [];
  try {
    for (const period of periods) {
      const [allRows, platformRows] = await Promise.all([
        fetchPeriod(period, false),
        fetchPeriod(period, true),
      ]);
      const rows = [
        ...allRows.map((row) => toPeriodRow(row, period, "all")),
        ...platformRows
          .filter((row) => ["facebook", "instagram"].includes(row.publisher_platform))
          .map((row) => toPeriodRow(row, period, row.publisher_platform)),
      ];
      await upsertInChunks(rows);
      summaries.push({ ...period, rows: rows.length });
    }
  } catch (error) {
    return Response.json({ error: String(error), completed: summaries }, { status: 502 });
  }

  return Response.json({ synced_at: new Date().toISOString(), periods: summaries });
});
