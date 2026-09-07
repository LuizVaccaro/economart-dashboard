const META_ACCOUNT_ID = '103801426';

function groupMetaDemographics(rows, part) {
  const grouped = {};
  rows.forEach(row => {
    const [age, gender] = row.dimension_value.split('|');
    const key = part === 'age' ? age : gender;
    if (key === 'unknown' || key === 'Unknown') return;
    grouped[key] = (grouped[key] || 0) + Number(row.reach || 0);
  });
  const labels = { female: 'Feminino', male: 'Masculino', '18-24': '18–24', '25-34': '25–34', '35-44': '35–44', '45-54': '45–54', '55-64': '55–64', '65+': '65+' };
  return Object.entries(grouped).map(([key, reach]) => ({ dimension_name: labels[key] || key, reach }));
}

async function tabPublicoMeta() {
  loading();
  const path = 'meta_audience_insights?select=period_start,period_end,platform,dimension,dimension_value,dimension_name,reach,impressions'
    + '&advertiser_id=eq.' + META_ACCOUNT_ID
    + '&period_start=lte.' + S.end + '&period_end=gte.' + S.start
    + '&order=period_end.desc,reach.desc';
  const snapshots = await supa(path);
  const latest = snapshots[0];
  if (!latest) {
    document.getElementById('content').innerHTML = '<div class="card audience-empty">Sem snapshot de público Meta para o período selecionado.</div>';
    return;
  }

  const rows = snapshots.filter(row => row.period_start === latest.period_start && row.period_end === latest.period_end);
  const demographics = rows.filter(row => row.dimension === 'age_gender');
  const ageOrder = ['18–24', '25–34', '35–44', '45–54', '55–64', '65+'];
  const ages = groupMetaDemographics(demographics, 'age')
    .sort((a, b) => ageOrder.indexOf(a.dimension_name) - ageOrder.indexOf(b.dimension_name));
  const genders = groupMetaDemographics(demographics, 'gender').sort((a, b) => b.reach - a.reach);
  const regions = rows.filter(row => row.dimension === 'region').sort((a, b) => Number(b.reach) - Number(a.reach));
  const facebook = rows.find(row => row.platform === 'facebook' && row.dimension === 'platform_total') || {};
  const instagram = rows.find(row => row.platform === 'instagram' && row.dimension === 'platform_total') || {};

  document.getElementById('content').innerHTML = `
    <div class="note"><strong>Público Meta</strong> · Snapshot de ${disp(latest.period_start)} a ${disp(latest.period_end)}. Alcance do período, sem somar dias.</div>
    <div class="audience-platform-grid">
      <section class="audience-platform-card is-facebook"><div><span>Facebook</span><strong>${fN(facebook.reach || 0)}</strong><small>alcance</small></div><div><strong>${fN(facebook.impressions || 0)}</strong><small>impressões</small></div></section>
      <section class="audience-platform-card is-instagram"><div><span>Instagram</span><strong>${fN(instagram.reach || 0)}</strong><small>alcance</small></div><div><strong>${fN(instagram.impressions || 0)}</strong><small>impressões</small></div></section>
    </div>
    <div class="audience-caveat"><strong>Leitura por plataforma:</strong> Facebook e Instagram podem ser comparados nos totais acima. A Graph API não permite cruzar <code>publisher_platform</code> com idade, gênero ou estado; por isso, os recortes abaixo representam o público Meta consolidado.</div>
    <div class="audience-grid audience-section">
      <section class="audience-card"><div class="audience-card-title">Alcance por idade · Meta</div>${audienceBarRows(ages, 'reach', 'is-meta')}</section>
      <section class="audience-card"><div class="audience-card-title">Alcance por gênero · Meta</div>${audienceBarRows(genders, 'reach', 'is-meta')}</section>
    </div>
    <section class="audience-card audience-section"><div class="audience-card-title">Alcance por estado · Meta</div>${audienceBarRows(regions, 'reach', 'is-meta')}</section>`;
}
