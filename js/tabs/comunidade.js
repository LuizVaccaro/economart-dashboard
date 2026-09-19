async function tabComunidade() {
  loading();
  ensureCreativeModal();

  const rows = await supaRpc('get_comunidade_best_ads', {
    p_start: S.start,
    p_end: S.end,
    p_platform: bestContentPlatform,
  });

  if (!rows.length) {
    document.getElementById('content').innerHTML = '<div class="card" style="padding:40px;text-align:center">Sem dados de campanhas de Comunidade no período selecionado</div>';
    return;
  }

  const sorted = rows.slice().sort((a, b) => (a.community_region || '').localeCompare(b.community_region || '', 'pt-BR'));

  let html = bestContentPlatformToolbar(rows) + '<div class="grid-3">';
  for (const row of sorted) {
    html += `
      <div class="quad-card">
        <div class="quad-title">${esc(row.community_region)}</div>
        ${creativeHeader(row)}
        <div class="quad-body">${metricsGridHtml(row, 'ig_profile')}</div>
      </div>`;
  }
  html += '</div>';

  document.getElementById('content').innerHTML = html;
}
