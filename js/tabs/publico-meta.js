const META_ACCOUNT_ID = '103801426';
let metaAudienceMode = 'paid';
let metaAudienceRows = [];
let metaAudienceSnapshot = null;

function setMetaAudienceMode(mode) {
  metaAudienceMode = mode === 'instagram' ? 'instagram' : 'paid';
  tabPublicoMeta();
}

function metaAudienceToolbar() {
  return `
    <div class="audience-source-toolbar">
      <div>
        <div class="best-content-toolbar-title">Fonte do público</div>
        <div class="best-content-toolbar-copy">Compare as audiências sem misturar mídia paga e seguidores.</div>
      </div>
      <div class="platform-toggle audience-source-toggle">
        <button class="platform-toggle-btn${metaAudienceMode === 'paid' ? ' active' : ''}" onclick="setMetaAudienceMode('paid')">Pago · Meta Ads</button>
        <button class="platform-toggle-btn${metaAudienceMode === 'instagram' ? ' active' : ''}" onclick="setMetaAudienceMode('instagram')">Orgânico · Instagram</button>
      </div>
    </div>`;
}

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

function renderPaidMetaAudience() {
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
  document.getElementById('content').innerHTML = `${metaAudienceToolbar()}
    <div class="note"><strong>Público pago · Meta Ads</strong> · Snapshot de ${disp(latest.period_start)} a ${disp(latest.period_end)}. Alcance do período, sem somar dias.</div>
    <div class="audience-caveat"><strong>Visão consolidada:</strong> pessoas alcançadas pelos anúncios no Facebook e Instagram. Este público não representa os seguidores do perfil.</div>
    <div class="audience-grid audience-section">
      <section class="audience-card"><div class="audience-card-title">Alcance pago por idade</div>${audienceBarRows(ages, 'reach', 'is-meta')}</section>
      <section class="audience-card"><div class="audience-card-title">Alcance pago por gênero</div>${audienceBarRows(genders, 'reach', 'is-meta')}</section>
    </div>
    <section class="audience-card audience-section"><div class="audience-card-title">Alcance pago por estado</div>${audienceBarRows(regions, 'reach', 'is-meta')}</section>`;
}

function renderInstagramAudience(rows, latest) {
  const ageOrder = ['13–17', '18–24', '25–34', '35–44', '45–54', '55–64', '65+'];
  const toAudienceRow = row => ({ dimension_name: row.dimension_name, value: Number(row.value || 0) });
  const ages = rows.filter(row => row.dimension === 'age').map(toAudienceRow)
    .sort((a, b) => ageOrder.indexOf(a.dimension_name) - ageOrder.indexOf(b.dimension_name));
  const genders = rows.filter(row => row.dimension === 'gender' && row.dimension_value !== 'U').map(toAudienceRow)
    .sort((a, b) => b.value - a.value);
  const cities = rows.filter(row => row.dimension === 'city').map(toAudienceRow)
    .sort((a, b) => b.value - a.value).slice(0, 15);
  const followers = Number(latest.followers_count || 0);

  document.getElementById('content').innerHTML = `${metaAudienceToolbar()}
    <div class="note"><strong>Público orgânico · Instagram</strong> · Snapshot de ${disp(latest.snapshot_date)} da conta @${esc(latest.username)}.</div>
    <div class="kpi-row audience-section">
      <div class="kpi kpi--instagram"><div class="kpi-label">Seguidores do Instagram</div><div class="kpi-value">${fN(followers)}</div></div>
    </div>
    <div class="audience-caveat"><strong>Base de seguidores:</strong> esta visão mostra o perfil demográfico atual dos seguidores e não varia com o filtro de período do dashboard.</div>
    <div class="audience-grid audience-section">
      <section class="audience-card"><div class="audience-card-title">Seguidores por idade</div>${audienceBarRows(ages, 'value', 'is-instagram')}</section>
      <section class="audience-card"><div class="audience-card-title">Seguidores por gênero</div>${audienceBarRows(genders, 'value', 'is-instagram')}</section>
    </div>
    <section class="audience-card audience-section"><div class="audience-card-title">Principais cidades dos seguidores</div>${audienceBarRows(cities, 'value', 'is-instagram')}</section>`;
}

async function tabPublicoMeta() {
  loading();

  if (metaAudienceMode === 'instagram') {
    const path = 'organic_audience_insights?select=source,profile_id,username,snapshot_date,dimension,dimension_value,dimension_name,value,followers_count'
      + '&source=eq.instagram&order=snapshot_date.desc,value.desc&limit=500';
    const snapshots = await supa(path);
    const latest = snapshots[0];
    if (!latest) {
      document.getElementById('content').innerHTML = `${metaAudienceToolbar()}<div class="card audience-empty">Sem snapshot do público orgânico do Instagram.</div>`;
      return;
    }
    const rows = snapshots.filter(row => row.snapshot_date === latest.snapshot_date && row.profile_id === latest.profile_id);
    renderInstagramAudience(rows, latest);
    return;
  }

  const path = 'meta_audience_insights?select=period_start,period_end,platform,dimension,dimension_value,dimension_name,reach,impressions'
    + '&advertiser_id=eq.' + META_ACCOUNT_ID
    + '&period_start=lte.' + S.end + '&period_end=gte.' + S.start
    + '&order=period_end.desc,reach.desc';
  const snapshots = await supa(path);
  const latest = snapshots[0];
  if (!latest) {
    document.getElementById('content').innerHTML = `${metaAudienceToolbar()}<div class="card audience-empty">Sem snapshot de público pago para o período selecionado.</div>`;
    return;
  }

  metaAudienceSnapshot = latest;
  metaAudienceRows = snapshots.filter(row => row.period_start === latest.period_start && row.period_end === latest.period_end);
  renderPaidMetaAudience();
}
