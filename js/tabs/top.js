async function tabTop() {
  loading();
  ensureCreativeModal();

  const rows = await supaRpc('get_top_creatives_by_reach', { p_start: S.start, p_end: S.end, p_limit: 10 });

  if (!rows.length) {
    document.getElementById('content').innerHTML = '<div class="card" style="padding:40px;text-align:center">Sem dados no período selecionado</div>';
    return;
  }

  const MEDAL = ['top-rank--gold', 'top-rank--silver', 'top-rank--bronze'];

  let listHtml = '';
  rows.forEach((row, idx) => {
    const onclick = "showCreative('" + safeAttr(row.creative_name) + "','" + safeAttr(row.thumbnail_url) + "','" + safeAttr(row.permalink_url) + "')";
    listHtml += `
      <div class="top-row" onclick="${onclick}">
        <div class="top-rank ${MEDAL[idx] || ''}">${idx + 1}</div>
        ${previewThumb(row.creative_name, row.thumbnail_url, row.permalink_url, 56)}
        <div class="top-info">
          <div class="top-name">${row.creative_name}</div>
          <div class="top-meta">${row.creative_format || ''} · roda em ${row.campaigns_count} campanha${row.campaigns_count > 1 ? 's' : ''}</div>
        </div>
        <div class="top-metrics">
          <div class="metric"><span class="metric-label">Gasto</span><span class="metric-value">${fR(row.spend)}</span></div>
          <div class="metric"><span class="metric-label">Thruplay</span><span class="metric-value">${fN(row.thruplay)}</span></div>
          <div class="metric"><span class="metric-label">Engaj.</span><span class="metric-value">${fN(row.page_engagement)}</span></div>
          <div class="metric"><span class="metric-label">Vis. perfil</span><span class="metric-value c-blue">${fN(row.profile_visits)}</span></div>
          <div class="metric"><span class="metric-label">Coment.</span><span class="metric-value">${fN(row.comments)}</span></div>
          <div class="metric"><span class="metric-label">Curtidas</span><span class="metric-value">${fN(row.likes)}</span></div>
          <div class="metric"><span class="metric-label">Alcance</span><span class="metric-value c-brand">${fN(row.reach)}</span></div>
        </div>
      </div>`;
  });

  document.getElementById('content').innerHTML = `<div class="card"><div class="card-title">Top 10 criativos por alcance</div>${listHtml}</div>`;
}
