const TIKTOK_ACCOUNT_ID = '7405555951194963985';
let __tiktokRows = [];

const ttEsc = value => String(value == null ? '' : value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const ttNum = value => Number(value || 0);

async function tabTikTok() {
  loading();
  ensureCreativeModal();

  const insightPath = 'ad_insights_daily?select=ad_id,campaign_id,adset_id,spend,impressions,clicks,reach,thruplay,page_engagement,comments,likes,profile_visits,follows,shares,video_views_6s,video_views_100,engaged_views'
    + '&platform=eq.tiktok&ad_account_id=eq.' + TIKTOK_ACCOUNT_ID
    + '&date=gte.' + S.start + '&date=lte.' + S.end;

  const [insights, ads, adsets, campaigns] = await Promise.all([
    supa(insightPath),
    supa('ads?select=id,name,adset_id,campaign_id,creative_format,thumbnail_url,permalink_url&platform=eq.tiktok&ad_account_id=eq.' + TIKTOK_ACCOUNT_ID),
    supa('adsets?select=id,name,campaign_id&platform=eq.tiktok&ad_account_id=eq.' + TIKTOK_ACCOUNT_ID),
    supa('campaigns?select=id,name&platform=eq.tiktok&ad_account_id=eq.' + TIKTOK_ACCOUNT_ID),
  ]);

  const adById = Object.fromEntries(ads.map(row => [row.id, row]));
  const adsetById = Object.fromEntries(adsets.map(row => [row.id, row]));
  const campaignById = Object.fromEntries(campaigns.map(row => [row.id, row]));
  const grouped = {};

  insights.forEach(row => {
    const ad = adById[row.ad_id] || {};
    const adset = adsetById[row.adset_id] || {};
    const campaign = campaignById[row.campaign_id] || {};
    const current = grouped[row.ad_id] || {
      ad_id: row.ad_id,
      ad_name: ad.name || row.ad_id,
      adset_id: row.adset_id,
      adset_name: adset.name || row.adset_id,
      campaign_id: row.campaign_id,
      campaign_name: campaign.name || row.campaign_id,
      creative_format: ad.creative_format,
      thumbnail_url: ad.thumbnail_url,
      permalink_url: ad.permalink_url,
      spend: 0, impressions: 0, clicks: 0, reach: 0,
      thruplay: 0, page_engagement: 0, comments: 0, likes: 0,
      profile_visits: 0, follows: 0, shares: 0,
      video_views_6s: 0, video_views_100: 0, engaged_views: 0,
    };

    ['spend','impressions','clicks','reach','thruplay','page_engagement','comments','likes',
      'profile_visits','follows','shares','video_views_6s','video_views_100','engaged_views']
      .forEach(key => { current[key] += ttNum(row[key]); });
    grouped[row.ad_id] = current;
  });

  __tiktokRows = Object.values(grouped)
    .filter(row => row.spend > 0 || row.impressions > 0 || row.reach > 0 || row.page_engagement > 0)
    .sort((a, b) => b.spend - a.spend);

  if (!__tiktokRows.length) {
    document.getElementById('content').innerHTML = '<div class="card" style="padding:40px;text-align:center">Sem dados do TikTok no período selecionado</div>';
    return;
  }

  document.getElementById('content').innerHTML = `
    <div class="note"><strong>TikTok Ads</strong> · Dados da conta Economart. “Visualizações completas” corresponde a 100% do vídeo e ocupa o campo de compatibilidade ThruPlay.</div>
    <div id="tiktokDashboard"></div>`;
  renderTikTokRows();
}

function renderTikTokRows() {
  const root = document.getElementById('tiktokDashboard');
  if (!root) return;
  const campaignSelect = document.getElementById('tiktokCampaign');
  const adsetSelect = document.getElementById('tiktokAdset');
  const selectedCampaign = campaignSelect ? campaignSelect.value : '';
  const selectedAdset = adsetSelect ? adsetSelect.value : '';

  const campaigns = [...new Map(__tiktokRows.map(row => [row.campaign_id, row.campaign_name])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  const availableAdsets = __tiktokRows.filter(row => !selectedCampaign || row.campaign_id === selectedCampaign);
  const adsets = [...new Map(availableAdsets.map(row => [row.adset_id, row.adset_name])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  const validAdset = adsets.some(([id]) => id === selectedAdset) ? selectedAdset : '';
  const rows = __tiktokRows.filter(row =>
    (!selectedCampaign || row.campaign_id === selectedCampaign) &&
    (!validAdset || row.adset_id === validAdset));

  const total = rows.reduce((acc, row) => {
    ['spend','reach','video_views_100','follows','page_engagement','profile_visits']
      .forEach(key => { acc[key] += ttNum(row[key]); });
    return acc;
  }, { spend:0, reach:0, video_views_100:0, follows:0, page_engagement:0, profile_visits:0 });

  const tableRows = rows.map(row => `
    <tr>
      <td>
        <div class="tiktok-ad">
          ${previewThumb(row.ad_name, row.thumbnail_url, row.permalink_url, 50)}
          <div><div class="tiktok-ad-name">${ttEsc(row.ad_name)}</div><div class="quad-format">${ttEsc(row.creative_format || '')}</div></div>
        </div>
      </td>
      <td><div class="tiktok-hierarchy"><strong>${ttEsc(row.campaign_name)}</strong><span>${ttEsc(row.adset_name)}</span></div></td>
      <td class="num strong">${fR(row.spend)}</td>
      <td class="num">${fN(row.reach)}</td>
      <td class="num">${fN(row.video_views_100 || row.thruplay)}</td>
      <td class="num">${fN(row.video_views_6s)}</td>
      <td class="num">${fN(row.follows)}</td>
      <td class="num">${fN(row.page_engagement)}</td>
      <td class="num">${fN(row.profile_visits)}</td>
    </tr>`).join('');


  root.innerHTML = `
    <div class="tiktok-toolbar">
      <div class="filter-group"><span class="filter-label">Campanha</span>
        <select class="filter-select" id="tiktokCampaign" onchange="renderTikTokRows()">
          <option value="">Todas as campanhas</option>
          ${campaigns.map(([id,name]) => `<option value="${ttEsc(id)}" ${id === selectedCampaign ? 'selected' : ''}>${ttEsc(name)}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group"><span class="filter-label">Grupo de anúncios</span>
        <select class="filter-select" id="tiktokAdset" onchange="renderTikTokRows()">
          <option value="">Todos os grupos</option>
          ${adsets.map(([id,name]) => `<option value="${ttEsc(id)}" ${id === validAdset ? 'selected' : ''}>${ttEsc(name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="kpi-row">
      <div class="kpi kpi--tiktok"><div class="kpi-label">Investimento</div><div class="kpi-value">${fR(total.spend)}</div></div>
      <div class="kpi kpi--tiktok"><div class="kpi-label">Alcance diário somado</div><div class="kpi-value">${fN(total.reach)}</div></div>
      <div class="kpi kpi--tiktok"><div class="kpi-label">Visualizações completas</div><div class="kpi-value">${fN(total.video_views_100)}</div></div>
      <div class="kpi kpi--tiktok"><div class="kpi-label">Novos seguidores</div><div class="kpi-value">${fN(total.follows)}</div></div>
      <div class="kpi kpi--tiktok"><div class="kpi-label">Engajamentos</div><div class="kpi-value">${fN(total.page_engagement)}</div></div>
      <div class="kpi kpi--tiktok"><div class="kpi-label">Visitas ao perfil</div><div class="kpi-value">${fN(total.profile_visits)}</div></div>
    </div>
    <div class="table-wrap tiktok-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Anúncio</th><th>Campanha / Grupo</th><th class="num th-tiktok">Investimento</th>
          <th class="num">Alcance</th><th class="num">100% vídeo</th><th class="num">Views 6s</th>
          <th class="num">Seguidores</th><th class="num">Engajamentos</th><th class="num">Visitas perfil</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;
}
