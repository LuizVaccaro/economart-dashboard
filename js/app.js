// ── State ──
let S = { start: '', end: '' };

function onQuickChange() {
  const v = document.getElementById('quickPeriod').value;
  if (v === 'custom') return;
  const { s, e } = PRESETS[v]();
  document.getElementById('startDate').value = s;
  document.getElementById('endDate').value = e;
  applyFilter();
}

function onDateManual() {
  document.getElementById('quickPeriod').value = 'custom';
}

function applyFilter() {
  const s = document.getElementById('startDate').value;
  const e = document.getElementById('endDate').value;
  if (!s || !e) { alert('Selecione as datas de início e fim.'); return; }
  S.start = s;
  S.end = e;
  document.getElementById('headerPeriod').textContent = `${disp(s)} → ${disp(e)}`;
  renderTab(activeTab);
}

// ── Tabs ──
const TABS = [
  { id: 'categorias', label: '📦 Categorias' },
  { id: 'comunidade', label: '📍 Comunidade' },
  { id: 'top', label: '🏆 Top Criativos' },
  { id: 'orcamento', label: '💰 Orçamento por Unidade' },
  { id: 'tiktok', label: 'TikTok Ads' },
];

let activeTab = 'categorias';

async function renderTab(id) {
  const fns = { categorias: tabCategorias, comunidade: tabComunidade, top: tabTop, orcamento: tabOrcamento, tiktok: tabTikTok };
  try {
    await (fns[id] || tabCategorias)();
  } catch (e) {
    document.getElementById('content').innerHTML = `
      <div class="card" style="text-align:center;padding:40px">
        <div style="font-size:32px;margin-bottom:12px">⚠️</div>
        <div style="font-size:15px;font-weight:600;margin-bottom:8px">Erro ao carregar dados</div>
        <div class="c-muted" style="font-size:13px">${e.message}</div>
      </div>`;
  }
}

function init() {
  const { s, e } = PRESETS['7d']();
  document.getElementById('startDate').value = s;
  document.getElementById('endDate').value = e;
  S.start = s; S.end = e;
  document.getElementById('headerPeriod').textContent = `${disp(s)} → ${disp(e)}`;

  const bar = document.getElementById('tabBar');
  bar.innerHTML = TABS.map(t => `<button class="tab${t.id === activeTab ? ' active' : ''}" data-id="${t.id}">${t.label}</button>`).join('');
  bar.addEventListener('click', async (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    activeTab = btn.dataset.id;
    bar.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.id === activeTab));
    await renderTab(activeTab);
  });

  ensureCreativeModal();
  renderTab(activeTab);
}

init();
