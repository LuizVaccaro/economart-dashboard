// Aba de Orçamento por Unidade — combina Meta e TikTok (diários) com Google Ads
// (granularidade mensal — o valor de cada mês é prorateado pelos dias desse mês
// que caem dentro do período filtrado no topo).
function orcamentoRow(r, max) {
  const pct = max > 0 ? Number(r.total_spend) / max : 0;
  const araxaNote = r.unit_code === 'araxa' ? '<span class="tag">fora do rateio</span>' : '';
  return `
    <tr>
      <td class="unit">${r.unit_name}${araxaNote}</td>
      <td class="num">${fR(r.meta_spend)}</td>
      <td class="num">${fR(r.tiktok_spend)}</td>
      <td class="num">${fR(r.google_spend)}</td>
      <td class="num strong bar-cell" style="--pct:${pct.toFixed(4)}">${fR(r.total_spend)}</td>
    </tr>`;
}

function orcamentoStateBlock(state, label, rows) {
  const stateRows = rows.filter(r => r.state === state).sort((a, b) => b.total_spend - a.total_spend);
  if (!stateRows.length) return '';
  const subtotal = stateRows.reduce((acc, r) => acc + Number(r.total_spend), 0);
  const max = Math.max(...stateRows.map(r => Number(r.total_spend)));
  return `
    <div class="category-section">
      <div class="category-title">${label} <span class="c-muted" style="font-weight:400;font-size:12px">— total ${fR(subtotal)}</span></div>
      <div class="table-wrap" style="overflow-x:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Unidade</th>
              <th class="num th-meta">Meta</th>
              <th class="num th-tiktok">TikTok</th>
              <th class="num th-google">Google</th>
              <th class="num">Total</th>
            </tr>
          </thead>
          <tbody>${stateRows.map(r => orcamentoRow(r, max)).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

async function tabOrcamento() {
  loading();

  const [rows, unclassified, rh] = await Promise.all([
    supaRpc('get_spend_by_unidade', { p_start: S.start, p_end: S.end }),
    supaRpc('get_unclassified_spend', { p_start: S.start, p_end: S.end }),
    supaRpc('get_rh_spend', { p_start: S.start, p_end: S.end }),
  ]);

  if (!rows.length) {
    document.getElementById('content').innerHTML = '<div class="card" style="padding:40px;text-align:center">Sem dados de orçamento no período</div>';
    return;
  }

  const grandTotal = rows.reduce((acc, r) => acc + Number(r.total_spend), 0);
  const metaTotal = rows.reduce((acc, r) => acc + Number(r.meta_spend), 0);
  const tiktokTotal = rows.reduce((acc, r) => acc + Number(r.tiktok_spend), 0);
  const googleTotal = rows.reduce((acc, r) => acc + Number(r.google_spend), 0);
  const rhRow = rh[0] || { meta_spend: 0, tiktok_spend: 0, google_spend: 0, total_spend: 0 };

  let html = `
    <div class="note">
      <strong>Meta e TikTok</strong> = dados diários sincronizados ·
      <strong>Google Ads</strong> = sincronização mensal no dia 5
      (o valor de cada mês é prorateado pelos dias dentro do período filtrado)
    </div>

    <div class="kpi-row">
      <div class="kpi kpi--meta">
        <div class="kpi-label">Total Meta</div>
        <div class="kpi-value">${fR(metaTotal)}</div>
      </div>
      <div class="kpi kpi--tiktok">
        <div class="kpi-label">Total TikTok</div>
        <div class="kpi-value">${fR(tiktokTotal)}</div>
      </div>
      <div class="kpi kpi--google">
        <div class="kpi-label">Total Google</div>
        <div class="kpi-value">${fR(googleTotal)}</div>
      </div>
      <div class="kpi kpi--hero">
        <div class="kpi-label">Total Geral · Lojas</div>
        <div class="kpi-value">${fR(grandTotal)}</div>
      </div>
    </div>

    <div class="panel" style="margin-bottom:26px">
      <div class="panel-title">RH / Recrutamento · rateio próprio, fora das lojas</div>
      <div class="panel-stats">
        <div class="panel-stat">
          <span class="panel-stat-label">Meta</span>
          <span class="panel-stat-value">${fR(rhRow.meta_spend)}</span>
        </div>
        <div class="panel-stat">
          <span class="panel-stat-label">TikTok</span>
          <span class="panel-stat-value">${fR(rhRow.tiktok_spend)}</span>
        </div>
        <div class="panel-stat">
          <span class="panel-stat-label">Google</span>
          <span class="panel-stat-value">${fR(rhRow.google_spend)}</span>
        </div>
        <div class="panel-stat">
          <span class="panel-stat-label">Total RH</span>
          <span class="panel-stat-value c-brand">${fR(rhRow.total_spend)}</span>
        </div>
      </div>
    </div>

    ${orcamentoStateBlock('BA', '🟠 Bahia', rows)}
    ${orcamentoStateBlock('MG', '🔵 Minas Gerais', rows)}
  `;

  if (unclassified.length) {
    html += `
      <div class="category-section">
        <div class="category-title">⚠️ Gasto não classificado</div>
        <div class="card">
          ${unclassified.map(u => `<div style="font-size:12px;margin-bottom:6px">${u.platform === 'meta' ? '📘' : u.platform === 'tiktok' ? '🎵' : '🔍'} ${u.campaign_name}${u.adset_name ? ' / ' + u.adset_name : ''} — ${fR(u.spend)}</div>`).join('')}
        </div>
      </div>`;
  }

  document.getElementById('content').innerHTML = html;
}
