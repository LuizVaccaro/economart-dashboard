import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const TOKEN = Deno.env.get("META_ACCESS_TOKEN");
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const GRAPH_VERSION = "v21.0";

type GraphResult = {
  ok: boolean;
  status: number;
  data?: any;
  error?: { message?: string; type?: string; code?: number; error_subcode?: number };
};

async function graph(
  path: string,
  params: Record<string, string> = {},
  accessToken = TOKEN,
): Promise<GraphResult> {
  const query = new URLSearchParams({ ...params, access_token: accessToken ?? "" });
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}?${query}`);
  const body = await response.json();
  return {
    ok: response.ok,
    status: response.status,
    data: response.ok ? body : undefined,
    error: response.ok ? undefined : {
      message: body.error?.message,
      type: body.error?.type,
      code: body.error?.code,
      error_subcode: body.error?.error_subcode,
    },
  };
}

function outcome(result: GraphResult, extra: Record<string, unknown> = {}) {
  return result.ok
    ? { ok: true, status: result.status, ...extra }
    : { ok: false, status: result.status, error: result.error };
}

Deno.serve(async (req: Request) => {
  if (!CRON_SECRET) return Response.json({ error: "CRON_SECRET secret not set" }, { status: 500 });
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!TOKEN) return Response.json({ error: "META_ACCESS_TOKEN secret not set" }, { status: 500 });

  const [accounts, permissions] = await Promise.all([
    graph("me/accounts", {
    fields: "id,name,access_token,instagram_business_account{id,username}",
    limit: "100",
    }),
    graph("me/permissions"),
  ]);
  if (!accounts.ok) return Response.json({ accounts: outcome(accounts) }, { status: 200 });

  const results = [];
  for (const page of accounts.data?.data ?? []) {
    const pageToken = page.access_token ?? TOKEN;
    const posts = await graph(`${page.id}/posts`, {
      fields: "id,created_time,permalink_url",
      limit: "1",
    }, pageToken);
    let postInsights: GraphResult | null = null;
    const post = posts.data?.data?.[0];
    if (post?.id) {
      postInsights = await graph(`${post.id}/insights`, {
        metric: "post_impressions,post_impressions_unique,post_engaged_users,post_clicks",
      }, pageToken);
    }

    let instagram: Record<string, unknown> | null = null;
    const ig = page.instagram_business_account;
    if (ig?.id) {
      const profile = await graph(ig.id, {
        fields: "id,username,followers_count,media_count",
      }, pageToken);
      const media = await graph(`${ig.id}/media`, {
        fields: "id,media_type,timestamp,permalink,like_count,comments_count",
        limit: "1",
      }, pageToken);
      const sample = media.data?.data?.[0];
      const metricNames = ["reach", "saved", "shares", "total_interactions", "views"];
      const metricTests: Record<string, unknown> = {};
      if (sample?.id) {
        const tested = await Promise.all(metricNames.map(async (metric) => {
          const metricResult = await graph(`${sample.id}/insights`, { metric }, pageToken);
          return [metric, outcome(metricResult, metricResult.ok ? {
            values: metricResult.data?.data ?? [],
          } : {})];
        }));
        Object.assign(metricTests, Object.fromEntries(tested));
      }
      instagram = {
        profile: outcome(profile, profile.ok ? {
          username: profile.data?.username,
          followers_count: profile.data?.followers_count,
          media_count: profile.data?.media_count,
        } : {}),
        media: outcome(media, media.ok ? {
          sample_media_type: sample?.media_type ?? null,
          sample_timestamp: sample?.timestamp ?? null,
          sample_like_count: sample?.like_count ?? null,
          sample_comments_count: sample?.comments_count ?? null,
          has_sample: Boolean(sample),
        } : {}),
        media_insights: metricTests,
      };
    }

    results.push({
      page: { id: page.id, name: page.name },
      facebook: {
        posts: outcome(posts, posts.ok ? { has_sample: Boolean(post), sample_created_time: post?.created_time ?? null } : {}),
        post_insights: postInsights ? outcome(postInsights) : { ok: false, reason: "no_sample_post" },
      },
      instagram,
    });
  }

  return Response.json({
    checked_at: new Date().toISOString(),
    accounts: outcome(accounts, { count: results.length }),
    permissions: outcome(permissions, permissions.ok ? {
      granted: (permissions.data?.data ?? []).filter((item: any) => item.status === "granted").map((item: any) => item.permission),
      declined: (permissions.data?.data ?? []).filter((item: any) => item.status !== "granted").map((item: any) => item.permission),
    } : {}),
    results,
  });
});
