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

function organicSparkline(rows, metric, color) {
  const values = rows.filter(row => row.metric === metric)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(row => Number(row.value || 0));
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 34 - ((value - min) / spread) * 28;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  return `<svg class="organic-sparkline" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function organicKpi(label, value, tone, sparkline) {
  return `<article class="organic-kpi organic-kpi--${tone}">
    <div class="organic-kpi-label">${label}</div>
    <div class="organic-kpi-value">${value == null ? '—' : fN(value)}</div>
    ${sparkline || ''}
  </article>`;
}

function organicMediaType(type) {
  return ({ VIDEO: 'Vídeo', CAROUSEL_ALBUM: 'Carrossel', IMAGE: 'Foto' })[type] || esc(type || 'Post');
}

function renderInstagramContent(content) {
  const metricMap = Object.fromEntries(content.period.map(row => [row.metric, Number(row.value || 0)]));
  const followerRows = content.daily.filter(row => row.metric === 'follower_count');
  const newFollowers = followerRows.length ? followerRows.reduce((sum, row) => sum + Number(row.value || 0), 0) : null;
  const followerLatestDate = followerRows.length ? followerRows.map(row => row.date).sort().at(-1) : null;
  const hasPeriod = content.period.length > 0;
  const cards = [
    organicKpi('Alcance', hasPeriod ? metricMap.reach : null, 'green', organicSparkline(content.daily, 'reach', '#169447')),
    organicKpi('Novos seguidores', newFollowers, 'blue', organicSparkline(content.daily, 'follower_count', '#2563eb')),
    organicKpi('Visualizações', hasPeriod ? metricMap.views : null, 'indigo', ''),
    organicKpi('Interações', hasPeriod ? metricMap.total_interactions : null, 'purple', ''),
    organicKpi('Cliques no link', hasPeriod ? metricMap.website_clicks : null, 'orange', ''),
    organicKpi('Visitas ao perfil', hasPeriod ? metricMap.profile_views : null, 'red', ''),
  ].join('');

  const rows = content.media.map(post => {
    const preview = previewThumb(post.caption || organicMediaType(post.media_type), post.thumbnail_url || post.media_url, post.permalink, 58);
    const engagement = post.total_interactions != null
      ? Number(post.total_interactions)
      : Number(post.likes || 0) + Number(post.comments || 0) + Number(post.saved || 0) + Number(post.shares || 0);
    return `<tr>
      <td class="organic-preview-cell">${preview}</td>
      <td><div class="organic-post-type">${organicMediaType(post.media_type)}</div><div class="organic-post-caption">${esc(post.caption || 'Sem legenda')}</div></td>
      <td class="num">${disp(String(post.published_at).slice(0, 10))}</td>
      <td class="num">${fN(post.reach)}</td>
      <td class="num">${fN(post.likes)}</td>
      <td class="num">${fN(post.comments)}</td>
      <td class="num">${fN(post.saved)}</td>
      <td class="num">${fN(post.shares)}</td>
      <td class="num organic-engagement">${fN(engagement)}</td>
    </tr>`;
  }).join('');

  return `<section class="organic-content-section">
    <div class="organic-section-heading">
      <div><h2>Conteúdo orgânico do Instagram</h2><p>${disp(S.start)} → ${disp(S.end)}</p></div>
      <span class="organic-source-badge">Instagram API</span>
    </div>
    ${hasPeriod ? '' : '<div class="note"><strong>Período ainda não sincronizado:</strong> os totais aparecem após a próxima coleta diária. Os posts já disponíveis continuam listados abaixo.</div>'}
    <div class="organic-kpi-grid">${cards}</div>
    <div class="organic-data-note">Alcance, visualizações, interações, cliques e visitas são totais consolidados do período. Novos seguidores usa a série diária da Meta${followerLatestDate ? `, disponível até ${disp(followerLatestDate)}` : ''}.</div>
    <div class="organic-posts-card">
      <div class="organic-posts-title">Posts orgânicos (${disp(S.start)} → ${disp(S.end)}) <span>${content.media.length} publicações</span></div>
      <div class="organic-table-scroll">
        <table class="data-table organic-posts-table">
          <thead><tr><th aria-label="Prévia"></th><th>Tipo / conteúdo</th><th class="num">Data</th><th class="num">Alcance</th><th class="num">Curtidas</th><th class="num">Comentários</th><th class="num">Salvos</th><th class="num">Compart.</th><th class="num">Engajamento</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="9" class="audience-empty">Nenhum post publicado no período selecionado.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  </section>`;
}

async function loadInstagramContent() {
  const nextDay = fmt(addDays(new Date(`${S.end}T12:00:00`), 1));
  const [period, daily, media] = await Promise.all([
    supa('instagram_account_insights_period?select=metric,value,synced_at&period_start=eq.' + S.start + '&period_end=eq.' + S.end + '&order=metric'),
    supa('instagram_account_insights_daily?select=date,metric,value&date=gte.' + S.start + '&date=lte.' + S.end + '&order=date.asc'),
    supa('instagram_media_insights?select=media_id,caption,media_type,published_at,permalink,thumbnail_url,media_url,reach,views,likes,comments,saved,shares,total_interactions&published_at=gte.' + S.start + 'T03:00:00Z&published_at=lt.' + nextDay + 'T03:00:00Z&order=published_at.desc'),
  ]);
  return { period, daily, media };
}

function renderInstagramAudience(rows, latest, content) {
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
    <section class="audience-card audience-section"><div class="audience-card-title">Principais cidades dos seguidores</div>${audienceBarRows(cities, 'value', 'is-instagram')}</section>
    ${renderInstagramContent(content)}`;
}

async function tabPublicoMeta() {
  loading();

  if (metaAudienceMode === 'instagram') {
    const path = 'organic_audience_insights?select=source,profile_id,username,snapshot_date,dimension,dimension_value,dimension_name,value,followers_count'
      + '&source=eq.instagram&order=snapshot_date.desc,value.desc&limit=500';
    const [snapshots, organicContent] = await Promise.all([supa(path), loadInstagramContent()]);
    const latest = snapshots[0];
    if (!latest) {
      document.getElementById('content').innerHTML = `${metaAudienceToolbar()}<div class="card audience-empty">Sem snapshot do público orgânico do Instagram.</div>`;
      return;
    }
    const rows = snapshots.filter(row => row.snapshot_date === latest.snapshot_date && row.profile_id === latest.profile_id);
    renderInstagramAudience(rows, latest, organicContent);
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
