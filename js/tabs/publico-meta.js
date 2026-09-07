const META_ACCOUNT_ID = '103801426';
let metaAudienceRows = [];
let metaAudienceSnapshot = null;
let metaAudiencePlatform = 'facebook';

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

function setMetaAudiencePlatform(platform) {
  metaAudiencePlatform = platform;
  renderMetaAudience();
}

function renderMetaAudience() {
  const rows = metaAudienceRows;
  const latest = metaAudienceSnapshot;
  const demographics = rows.filter(row => row.dimension === 'age_gender');
  const ageOrder = ['18–24', '25–34', '35–44', '45–54', '55–64', '65+'];
  const ages = groupMetaDemographics(demographics, 'age')
    .sort((a, b) => ageOrder.indexOf(a.dimension_name) - ageOrder.indexOf(b.dimension_name));
  const genders = groupMetaDemographics(demographics, 'gender').sort((a, b) => b.reach - a.reach);
  const allowedRegions = ['Minas Gerais', 'Bahia'];
  const regions = rows
    .filter(row => row.dimension === 'region' && allowedRegions.includes(row.dimension_name))
    .sort((a, b) => Number(b.reach) - Number(a.reach));
  const platform = rows.find(row => row.platform === metaAudiencePlatform && row.dimension === 'platform_total') || {};
  const label = metaAudiencePlatform === 'facebook' ? 'Facebook' : 'Instagram';

  document.getElementById('content').innerHTML = `
    <div class="note"><strong>Público Meta</strong> · Snapshot de ${disp(latest.period_start)} a ${disp(latest.period_end)}. Alcance do período, sem somar dias.</div>
    <div class="audience-subtabs" role="tablist" aria-label="Plataforma Meta">
      <button class="audience-subtab ${metaAudiencePlatform === 'facebook' ? 'is-active is-facebook' : ''}" role="tab" aria-selected="${metaAudiencePlatform === 'facebook'}" onclick="setMetaAudiencePlatform('facebook')">Facebook</button>
      <button class="audience-subtab ${metaAudiencePlatform === 'instagram' ? 'is-active is-instagram' : ''}" role="tab" aria-selected="${metaAudiencePlatform === 'instagram'}" onclick="setMetaAudiencePlatform('instagram')">Instagram</button>
    </div>
    <section class="audience-platform-card audience-platform-selected is-${metaAudiencePlatform}">
      <div><span>${label}</span><strong>${fN(platform.reach || 0)}</strong><small>alcance</small></div>
      <div><strong>${fN(platform.impressions || 0)}</strong><small>impressões</small></div>
    </section>
    <div class="audience-caveat"><strong>Demografia e localização · Meta consolidado:</strong> a Graph API não permite cruzar <code>publisher_platform</code> com idade, gênero ou estado. Esses recortes representam Facebook e Instagram em conjunto; somente o cartão acima muda entre as sub-abas.</div>
    <div class="audience-grid audience-section">
      <section class="audience-card"><div class="audience-card-title">Alcance por idade · Meta consolidado</div>${audienceBarRows(ages, 'reach', 'is-meta')}</section>
      <section class="audience-card"><div class="audience-card-title">Alcance por gênero · Meta consolidado</div>${audienceBarRows(genders, 'reach', 'is-meta')}</section>
    </div>
    <section class="audience-card audience-section"><div class="audience-card-title">Alcance por estado · Meta consolidado</div>${audienceBarRows(regions, 'reach', 'is-meta')}</section>`;
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

  metaAudienceSnapshot = latest;
  metaAudienceRows = snapshots.filter(row => row.period_start === latest.period_start && row.period_end === latest.period_end);
  renderMetaAudience();
}
