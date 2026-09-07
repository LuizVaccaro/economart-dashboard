function audienceEsc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function audienceBarRows(rows, metric, accentClass = '') {
  const max = Math.max(...rows.map(row => Number(row[metric] || 0)), 1);
  return rows.map(row => {
    const value = Number(row[metric] || 0);
    return `<div class="audience-bar-row">
      <div class="audience-bar-label">${audienceEsc(row.dimension_name)}</div>
      <div class="audience-bar-track"><span class="${accentClass}" style="width:${(value / max) * 100}%"></span></div>
      <div class="audience-bar-value">${fN(value)}</div>
    </div>`;
  }).join('');
}

async function tabPublicoTikTok() {
  loading();
  const path = 'tiktok_audience_insights?select=period_start,period_end,dimension,dimension_value,dimension_name,reach,impressions,clicks,spend'
    + '&advertiser_id=eq.' + TIKTOK_ACCOUNT_ID
    + '&period_start=lte.' + S.end + '&period_end=gte.' + S.start
    + '&order=period_end.desc,dimension.asc,impressions.desc';
  const snapshots = await supa(path);
  const latest = snapshots[0];
  if (!latest) {
    document.getElementById('content').innerHTML = '<div class="card audience-empty">Sem snapshot de público TikTok para o período selecionado.</div>';
    return;
  }

  const rows = snapshots.filter(row => row.period_start === latest.period_start && row.period_end === latest.period_end);
  const ages = rows.filter(row => row.dimension === 'age').sort((a, b) => a.dimension_value.localeCompare(b.dimension_value));
  const genders = rows.filter(row => row.dimension === 'gender').sort((a, b) => Number(b.reach) - Number(a.reach));
  const provinces = rows.filter(row => row.dimension === 'province').sort((a, b) => Number(b.reach) - Number(a.reach));
  const interests = rows.filter(row => row.dimension === 'interest_category').sort((a, b) => Number(b.impressions) - Number(a.impressions)).slice(0, 10);

  const interestRows = interests.map((row, index) => {
    const impressions = Number(row.impressions || 0);
    const clicks = Number(row.clicks || 0);
    const spend = Number(row.spend || 0);
    const ctr = impressions ? clicks / impressions * 100 : 0;
    return `<tr><td class="audience-rank">${index + 1}</td><td><strong>${audienceEsc(row.dimension_name)}</strong></td>
      <td class="num strong">${fN(impressions)}</td><td class="num">${fN(clicks)}</td>
      <td class="num">${ctr.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>
      <td class="num">${fR(spend)}</td></tr>`;
  }).join('');

  document.getElementById('content').innerHTML = `
    <div class="note"><strong>Público TikTok</strong> · Snapshot de ${disp(latest.period_start)} a ${disp(latest.period_end)}. Alcance do período, sem somar dias.</div>
    <div class="audience-grid">
      <section class="audience-card"><div class="audience-card-title">Alcance por idade</div>${audienceBarRows(ages, 'reach', 'is-tiktok')}</section>
      <section class="audience-card"><div class="audience-card-title">Alcance por gênero</div>${audienceBarRows(genders, 'reach', 'is-tiktok')}</section>
    </div>
    <section class="audience-card audience-section">
      <div class="audience-card-title">Alcance por estado</div>${audienceBarRows(provinces, 'reach', 'is-tiktok')}
    </section>
    <div class="audience-heading"><div><h2>Interesses do público</h2><p>Top 10 por impressões. As categorias se sobrepõem e não devem ser somadas.</p></div></div>
    <div class="table-wrap tiktok-table-wrap"><table class="data-table"><thead><tr>
      <th>#</th><th>Interesse</th><th class="num th-tiktok">Impressões</th><th class="num">Cliques</th><th class="num">CTR</th><th class="num">Investimento atribuído</th>
    </tr></thead><tbody>${interestRows}</tbody></table></div>
    <div class="audience-caveat"><strong>Comportamentos:</strong> o relatório aceita a dimensão, mas atualmente retorna apenas IDs técnicos e alcance zero. Ela fica fora do ranking até o TikTok disponibilizar dados interpretáveis.</div>`;
}
