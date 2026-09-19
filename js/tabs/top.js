async function tabTop() {
  loading();
  ensureCreativeModal();

  const rows = await supaRpc('get_top_ads_by_reach', {
    p_start: S.start,
    p_end: S.end,
    p_limit: 10,
    p_platform: bestContentPlatform,
  });

  if (!rows.length) {
    document.getElementById('content').innerHTML = '<div class="card" style="padding:40px;text-align:center">Sem dados no período selecionado</div>';
    return;
  }

  const MEDAL = ['top-rank--gold', 'top-rank--silver', 'top-rank--bronze'];

  let listHtml = '';
  rows.forEach((row, idx) => {
    const usesImpressionFallback = row.reach_is_period_unique === false;
    listHtml += `
      <div class="top-row">
        <div class="top-rank ${MEDAL[idx] || ''}">${idx + 1}</div>
        ${previewThumb(row.creative_name, row.thumbnail_url, row.permalink_url, 56)}
        <div class="top-info">
          <div class="top-name">${esc(row.creative_name)}</div>
          <div class="top-meta">${esc(row.creative_format || '')}${row.campaign_name ? ` · ${esc(row.campaign_name)}` : ''}</div>
        </div>
        <div class="top-metrics">
          <div class="metric"><span class="metric-label">Gasto</span><span class="metric-value">${fR(row.spend)}</span></div>
          <div class="metric"><span class="metric-label">Thruplay</span><span class="metric-value">${fN(row.thruplay)}</span></div>
          <div class="metric"><span class="metric-label">Engaj.</span><span class="metric-value">${fN(row.page_engagement)}</span></div>
          <div class="metric"><span class="metric-label">Vis. perfil</span><span class="metric-value c-blue">${fN(row.profile_visits)}</span></div>
          <div class="metric"><span class="metric-label">Coment.</span><span class="metric-value">${fN(row.comments)}</span></div>
          <div class="metric"><span class="metric-label">Curtidas</span><span class="metric-value">${fN(row.likes)}</span></div>
          <div class="metric"><span class="metric-label">${usesImpressionFallback ? 'Impressões' : 'Alcance do período'}</span><span class="metric-value c-brand">${fN(usesImpressionFallback ? row.impressions : row.reach)}</span></div>
        </div>
      </div>`;
  });

  const usesImpressionFallback = rows.some(row => row.reach_is_period_unique === false);
  document.getElementById('content').innerHTML = `${bestContentPlatformToolbar(rows)}<div class="card"><div class="card-title">Top 10 anúncios por ${usesImpressionFallback ? 'impressões' : 'alcance do período'}</div>${listHtml}</div>`;
}
