import { createClient } from "jsr:@supabase/supabase-js@2";

const TOKEN = Deno.env.get("META_ACCESS_TOKEN");
const ACCOUNT = Deno.env.get("META_AD_ACCOUNT_ID") ?? "103801426";
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const VERSION = "v21.0";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function localDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

async function report(since: string, until: string, breakdowns: string) {
  const params = new URLSearchParams({
    level: "account", limit: "500", breakdowns,
    time_range: JSON.stringify({ since, until }), fields: "reach,impressions",
    access_token: TOKEN ?? "",
  });
  const response = await fetch(`https://graph.facebook.com/${VERSION}/act_${ACCOUNT}/insights?${params}`);
  const json = await response.json();
  if (!response.ok) throw new Error(`Meta ${breakdowns}: ${JSON.stringify(json)}`);
  return json.data ?? [];
}

Deno.serve(async (req: Request) => {
  if (!CRON_SECRET) return Response.json({ error: "CRON_SECRET secret not set" }, { status: 500 });
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!TOKEN) return Response.json({ error: "META_ACCESS_TOKEN secret not set" }, { status: 500 });

  const url = new URL(req.url);
  const until = url.searchParams.get("until") ?? localDate();
  const since = url.searchParams.get("since") ?? `${until.slice(0, 7)}-01`;

  try {
    const [demographics, regions, platforms] = await Promise.all([
      report(since, until, "age,gender"), report(since, until, "region"), report(since, until, "publisher_platform"),
    ]);
    const synced_at = new Date().toISOString();
    const genderLabel: Record<string, string> = { female: "Feminino", male: "Masculino", unknown: "Não informado" };
    const rows = [
      ...demographics.filter((r: any) => r.age !== "Unknown").map((r: any) => ({
        advertiser_id: ACCOUNT, period_start: since, period_end: until, platform: "meta",
        dimension: "age_gender", dimension_value: `${r.age}|${r.gender}`,
        dimension_name: `${r.age.replace("-", "–")} · ${genderLabel[r.gender] ?? r.gender}`,
        reach: Number(r.reach ?? 0), impressions: Number(r.impressions ?? 0), synced_at,
      })),
      ...regions.filter((r: any) => r.region !== "Unknown").map((r: any) => ({
        advertiser_id: ACCOUNT, period_start: since, period_end: until, platform: "meta",
        dimension: "region", dimension_value: r.region,
        dimension_name: r.region.replace("Rio de Janeiro (state)", "Rio de Janeiro").replace("São Paulo (state)", "São Paulo"),
        reach: Number(r.reach ?? 0), impressions: Number(r.impressions ?? 0), synced_at,
      })),
      ...platforms.filter((r: any) => ["facebook", "instagram"].includes(r.publisher_platform)).map((r: any) => ({
        advertiser_id: ACCOUNT, period_start: since, period_end: until, platform: r.publisher_platform,
        dimension: "platform_total", dimension_value: r.publisher_platform,
        dimension_name: r.publisher_platform === "facebook" ? "Facebook" : "Instagram",
        reach: Number(r.reach ?? 0), impressions: Number(r.impressions ?? 0), synced_at,
      })),
    ];
    const { error } = await db.from("meta_audience_insights").upsert(rows, {
      onConflict: "advertiser_id,period_start,period_end,platform,dimension,dimension_value",
    });
    if (error) throw error;
    return Response.json({ since, until, rows: rows.length });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 502 });
  }
});
