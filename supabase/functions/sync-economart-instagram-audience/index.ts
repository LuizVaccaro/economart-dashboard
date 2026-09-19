import { createClient } from "jsr:@supabase/supabase-js@2";

const TOKEN = Deno.env.get("META_ACCESS_TOKEN");
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const GRAPH_VERSION = "v21.0";
const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function localDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function graph(path: string, params: Record<string, string>, accessToken: string) {
  const query = new URLSearchParams({ ...params, access_token: accessToken });
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}?${query}`);
  const json = await response.json();
  if (!response.ok) throw new Error(`Meta ${path}: ${JSON.stringify(json.error ?? json)}`);
  return json;
}

function dimensionLabel(dimension: string, value: string) {
  if (dimension === "age") return value.replace("-", "–");
  if (dimension === "gender") {
    return value === "F" ? "Feminino" : value === "M" ? "Masculino" : "Não informado";
  }
  return value;
}

function extractBreakdown(insight: any) {
  return insight?.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
}

Deno.serve(async (req: Request) => {
  if (!CRON_SECRET) return Response.json({ error: "CRON_SECRET secret not set" }, { status: 500 });
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!TOKEN) return Response.json({ error: "META_ACCESS_TOKEN secret not set" }, { status: 500 });

  try {
    const accounts = await graph("me/accounts", {
      fields: "id,name,access_token,instagram_business_account{id,username}",
      limit: "100",
    }, TOKEN);
    const page = (accounts.data ?? []).find((item: any) =>
      item.instagram_business_account?.username === "economartbr"
    ) ?? (accounts.data ?? []).find((item: any) => item.instagram_business_account?.id);
    if (!page?.instagram_business_account?.id || !page.access_token) {
      throw new Error("Conta profissional do Instagram não encontrada nas páginas autorizadas");
    }

    const instagramUserId = page.instagram_business_account.id;
    const pageToken = page.access_token;
    const profile = await graph(instagramUserId, {
      fields: "id,username,followers_count",
    }, pageToken);
    const dimensions = ["age", "gender", "city", "country"];
    const reports = await Promise.all(dimensions.map(async (dimension) => ({
      dimension,
      insight: await graph(`${instagramUserId}/insights`, {
        metric: "follower_demographics",
        period: "lifetime",
        metric_type: "total_value",
        breakdown: dimension,
        timeframe: "this_month",
      }, pageToken),
    })));

    const snapshotDate = localDate();
    const syncedAt = new Date().toISOString();
    const rows = reports.flatMap(({ dimension, insight }) =>
      extractBreakdown(insight).map((result: any) => {
        const value = String(result.dimension_values?.[0] ?? "unknown");
        return {
          source: "instagram",
          profile_id: instagramUserId,
          username: profile.username,
          snapshot_date: snapshotDate,
          dimension,
          dimension_value: value,
          dimension_name: dimensionLabel(dimension, value),
          value: Number(result.value ?? 0),
          followers_count: Number(profile.followers_count ?? 0),
          synced_at: syncedAt,
        };
      })
    );

    const { error: deleteError } = await db.from("organic_audience_insights")
      .delete()
      .eq("source", "instagram")
      .eq("profile_id", instagramUserId)
      .eq("snapshot_date", snapshotDate);
    if (deleteError) throw deleteError;

    const { error: insertError } = await db.from("organic_audience_insights").insert(rows);
    if (insertError) throw insertError;

    return Response.json({
      snapshot_date: snapshotDate,
      username: profile.username,
      followers_count: Number(profile.followers_count ?? 0),
      rows: rows.length,
      dimensions: Object.fromEntries(reports.map(({ dimension, insight }) => [
        dimension,
        extractBreakdown(insight).length,
      ])),
    });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 502 });
  }
});
