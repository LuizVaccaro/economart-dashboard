# Facebook organic audience — prepared, not active

This integration is intentionally not deployed or scheduled.

Activation checklist:

1. Re-authorize `META_ACCESS_TOKEN` with `pages_read_engagement`.
2. Run the organic access validator and confirm that Page posts and Page Insights return HTTP 200.
3. Implement the final metric mapping against the fields actually returned by the current Graph API version.
4. Store rows in `organic_audience_insights` with `source = 'facebook'`.
5. Deploy the Edge Function and create its cron only after explicit approval.

The shared table and frontend source selector already support a future Facebook source, but the dashboard intentionally exposes only paid Meta and organic Instagram today.
