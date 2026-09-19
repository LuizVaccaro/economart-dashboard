// ── Date utils ──
const fmt      = d => d.toISOString().slice(0,10);
const disp     = s => new Date(s+'T12:00:00').toLocaleDateString('pt-BR');
const addDays  = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const today     = () => fmt(new Date());
const yesterday = () => fmt(addDays(new Date(), -1));

const PRESETS = {
  hoje:   () => { const t=today();     return {s:t,e:t}; },
  ontem:  () => { const y=yesterday(); return {s:y,e:y}; },
  '7d':   () => { const e=yesterday(); return {s:fmt(addDays(new Date(e),-6)),e}; },
  '14d':  () => { const e=yesterday(); return {s:fmt(addDays(new Date(e),-13)),e}; },
  '30d':  () => { const e=yesterday(); return {s:fmt(addDays(new Date(e),-29)),e}; },
  mes:    () => { const t=new Date(); const s=new Date(t.getFullYear(),t.getMonth(),1); const y=addDays(new Date(),-1); const e=y<s?today():fmt(y); return {s:fmt(s),e}; },
  mesant: () => { const t=new Date(); const s=new Date(t.getFullYear(),t.getMonth()-1,1); const e=new Date(t.getFullYear(),t.getMonth(),0); return {s:fmt(s),e:fmt(e)}; },
};

// ── Format helpers ──
const fN = n => n!=null && !isNaN(n) ? Number(n).toLocaleString('pt-BR') : '—';
const fS = n => n!=null && !isNaN(n) ? Number(n).toFixed(1)+'s' : '—';
const fR = n => n!=null && !isNaN(n) ? 'R$ '+Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';

const PLATFORM_LABEL = { instagram: '📷 Instagram', facebook: '📘 Facebook' };

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.href : '';
  } catch (_) {
    return '';
  }
}

function loading() {
  document.getElementById('content').innerHTML = `<div class="loading"><div class="spinner"></div>Carregando dados…</div>`;
}

// ── Creative preview modal (mesmo padrão do dashboard Jusfy) ──
function ensureCreativeModal() {
  if (document.getElementById('creativeModal')) return;
  const m = document.createElement('div');
  m.id = 'creativeModal';
  m.style.cssText = 'display:none;position:fixed;inset:0;background:#1f232899;backdrop-filter:blur(3px);z-index:9999;align-items:center;justify-content:center;padding:20px';
  m.innerHTML = `
    <div class="modal-box">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
        <div>
          <div class="modal-eyebrow">Preview do Criativo</div>
          <div id="modalAdName" class="modal-name"></div>
        </div>
        <button class="modal-close" onclick="document.getElementById('creativeModal').style.display='none'">&#x2715;</button>
      </div>
      <div id="modalContent" class="modal-content"></div>
      <div style="margin-top:12px">
        <a id="modalLink" class="modal-link" href="#" target="_blank" rel="noopener">Abrir no Gerenciador &#x2192;</a>
      </div>
    </div>`;
  m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
  document.body.appendChild(m);
}

function showCreative(name, thumb, managerUrl) {
  ensureCreativeModal();
  document.getElementById('modalAdName').textContent = String(name || 'Criativo');
  const content = document.getElementById('modalContent');
  const link    = document.getElementById('modalLink');
  const safeManagerUrl = safeHttpsUrl(managerUrl);
  const safeThumb = safeHttpsUrl(thumb);
  let managerHost = '';
  let managerPath = '';
  if (safeManagerUrl) {
    const parsed = new URL(safeManagerUrl);
    managerHost = parsed.hostname.toLowerCase();
    managerPath = parsed.pathname;
  }
  const isTikTokPreview = managerHost === 'ads.tiktok.com' && managerPath.startsWith('/ad_preview_tool');
  const isInstagramPost = (managerHost === 'instagram.com' || managerHost.endsWith('.instagram.com')) && managerPath.startsWith('/p/');

  if (isTikTokPreview) {
    const frame = document.createElement('iframe');
    frame.src = safeManagerUrl;
    frame.width = '100%';
    frame.height = '720';
    frame.frameBorder = '0';
    frame.allow = 'autoplay; fullscreen';
    frame.style.cssText = 'border-radius:8px;background:#000;max-width:480px';
    content.innerHTML = '';
    content.appendChild(frame);
    link.href = safeManagerUrl;
    link.textContent = 'Abrir preview no TikTok →';
  } else if (isInstagramPost) {
    const shortcode = managerPath.match(/^\/p\/([A-Za-z0-9_-]+)/)?.[1];
    if (shortcode) {
      content.innerHTML = '<iframe src="https://www.instagram.com/p/' + shortcode + '/embed/?autoplay=false" width="100%" height="780" frameborder="0" scrolling="yes" allowtransparency="true" style="border-radius:8px;background:#000;max-width:480px"></iframe>';
    } else {
      content.innerHTML = '<div class="modal-fallback">Preview não disponível</div>';
    }
    link.href = safeManagerUrl.split('#')[0];
    link.textContent = 'Abrir no Instagram →';
  } else if (safeThumb) {
    const img = document.createElement('img');
    img.src = safeThumb;
    img.style.cssText = 'width:100%;display:block;border-radius:4px';
    img.onerror = () => { content.innerHTML = '<div class="modal-fallback">Thumbnail indisponível</div>'; };
    content.innerHTML = '';
    content.appendChild(img);
    link.href = safeManagerUrl || 'https://business.facebook.com';
    link.textContent = 'Abrir no Gerenciador →';
  } else {
    content.innerHTML = '<div class="modal-fallback">Preview não disponível</div>';
    link.href = safeManagerUrl || '#';
    link.textContent = 'Abrir no Gerenciador →';
  }
  document.getElementById('creativeModal').style.display = 'flex';
}

window.__creativePreviewData = window.__creativePreviewData || {};
let __creativePreviewCounter = 0;

function registerCreativePreview(name, thumb, managerUrl) {
  const id = `creative-preview-${__creativePreviewCounter++}`;
  window.__creativePreviewData[id] = { name, thumb, managerUrl };
  return id;
}

function showCreativeById(id) {
  const data = window.__creativePreviewData[id];
  if (data) showCreative(data.name, data.thumb, data.managerUrl);
}

// Miniatura pequena e nítida (estilo Gerenciador de Anúncios) com selo de play —
// clique abre o modal com o preview completo (imagem/vídeo sem cortar)
function previewThumb(name, thumb, managerUrl, size) {
  size = size || 56;
  const badge = Math.max(18, Math.round(size * 0.3));
  const previewId = registerCreativePreview(name, thumb, managerUrl);
  const safeThumb = safeHttpsUrl(thumb);
  return `
    <button type="button" class="thumb" onclick="event.stopPropagation();showCreativeById('${previewId}')" aria-label="Abrir preview de ${esc(name)}" style="width:${size}px;height:${size}px">
      ${safeThumb
        ? `<img src="${esc(safeThumb)}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center;display:block" onerror="this.style.display='none'"/>`
        : '<span class="thumb-empty">Sem preview</span>'}
      <span class="thumb-play" style="width:${badge}px;height:${badge}px;font-size:${Math.round(badge * 0.42)}px">&#x25B6;</span>
    </button>`;
}

// ── Widget de métricas com alternância Geral / Facebook / Instagram ──
window.__quadData = window.__quadData || {};
let __quadCounter = 0;

function statRow(label, value) {
  const empty = value === '—' ? ' is-empty' : '';
  return `<div class="stat"><span class="stat-label">${label}</span><span class="stat-value${empty}">${value}</span></div>`;
}

// A métrica em destaque é a do objetivo da campanha — mesma lógica que define o
// "melhor criativo" no banco (alcance vs. visitas ao perfil).
function metricsGridHtml(data, objectiveKey) {
  if (!data) {
    return '<div class="quad-empty">Sem dados nessa plataforma</div>';
  }
  const isProfile = objectiveKey === 'ig_profile';
  const usesImpressionFallback = !isProfile && data.reach_is_period_unique === false;
  const heroLabel = isProfile ? 'Visitas ao perfil' : (usesImpressionFallback ? 'Impressões' : 'Alcance do período');
  const heroValue = fN(isProfile ? data.profile_visits : (usesImpressionFallback ? data.impressions : data.reach));
  const secondary = isProfile
    ? statRow(data.reach_is_period_unique === false ? 'Impressões' : 'Alcance do período', fN(data.reach_is_period_unique === false ? data.impressions : data.reach))
    : statRow('Visitas ao perfil', fN(data.profile_visits));

  return `
    <div class="hero-row">
      <div class="hero-metric hero-metric--accent">
        <span class="hero-label">${heroLabel}</span>
        <span class="hero-value">${heroValue}</span>
      </div>
      <div class="hero-metric">
        <span class="hero-label">Gasto</span>
        <span class="hero-value">${fR(data.spend)}</span>
      </div>
    </div>
    <div class="stat-list">
      ${secondary}
      ${statRow('Engaj. c/ página', fN(data.page_engagement))}
      ${statRow('Tempo de view', fS(data.video_avg_watch_time))}
      ${statRow('Thruplay', fN(data.thruplay))}
      ${statRow('Comentários', fN(data.comments))}
      ${statRow('Curtidas', fN(data.likes))}
    </div>`;
}

function bestContentPlatformToolbar(rows) {
  const labels = { all: 'Geral', facebook: '📘 Facebook', instagram: '📷 Instagram' };
  const exact = rows.length > 0 && rows.every(row => row.reach_is_period_unique !== false);
  return `
    <div class="best-content-toolbar">
      <div>
        <div class="best-content-toolbar-title">Melhor anúncio do período</div>
        <div class="best-content-toolbar-copy">O vencedor é recalculado para a plataforma selecionada.</div>
      </div>
      <div class="platform-toggle best-content-platform-toggle">
        ${Object.entries(labels).map(([key, label]) => `
          <button class="platform-toggle-btn${bestContentPlatform === key ? ' active' : ''}"
            onclick="setBestContentPlatform('${key}')">${label}</button>`).join('')}
      </div>
    </div>
    <div class="note best-content-method-note">
      ${exact
        ? '<strong>Ranking comparável ao Gerenciador:</strong> um anúncio por grupo, usando métricas consolidadas do período.'
        : '<strong>Período ainda sem snapshot consolidado:</strong> o ranking de alcance usa impressões como fallback. O alcance diário não é somado.'}
    </div>`;
}

function switchQuadPlatform(id, key) {
  const entry = window.__quadData[id];
  if (!entry) return;
  const data = key === 'geral' ? entry.row : (entry.row.by_platform || {})[key];
  const container = document.getElementById(id + '-metrics');
  if (container) container.innerHTML = metricsGridHtml(data, entry.objectiveKey);
  document.querySelectorAll('#' + id + '-toggle .platform-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.key === key);
  });
}

// Widget completo: botões Geral/Facebook/Instagram + métricas (troca sem reconsultar o banco)
function platformToggleWidget(row, objectiveKey) {
  const id = 'quad' + (__quadCounter++);
  window.__quadData[id] = { row: row, objectiveKey: objectiveKey };
  return `
    <div class="platform-toggle" id="${id}-toggle">
      <button class="platform-toggle-btn active" data-key="geral" onclick="switchQuadPlatform('${id}','geral')">Geral</button>
      <button class="platform-toggle-btn" data-key="facebook" onclick="switchQuadPlatform('${id}','facebook')">📘 Facebook</button>
      <button class="platform-toggle-btn" data-key="instagram" onclick="switchQuadPlatform('${id}','instagram')">📷 Instagram</button>
    </div>
    <div id="${id}-metrics">${metricsGridHtml(row, objectiveKey)}</div>`;
}

// Cabeçalho padrão de um card de criativo: preview + nome + formato
function creativeHeader(row, size) {
  return `
    <div class="quad-header">
      ${previewThumb(row.creative_name, row.thumbnail_url, row.permalink_url, size || 76)}
      <div class="quad-id">
        <div class="quad-creative-name">${esc(row.creative_name)}</div>
        ${row.creative_format ? `<div class="quad-format">${esc(row.creative_format)}</div>` : ''}
      </div>
    </div>`;
}
