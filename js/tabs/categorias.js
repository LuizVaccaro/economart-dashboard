const OBJECTIVE_LABEL = {
  alcance: 'Objetivo: Alcance',
  ig_profile: 'Objetivo: Acesso ao Perfil (IG)',
};

// Ordem fixa pedida pelo cliente — categorias fora dessa lista aparecem no final, em ordem alfabética
const CATEGORY_ORDER = [
  'institucional', 'interação', 'humor', 'bazar', 'uso pessoal',
  'limpeza', 'saudabilidade', 'bebidas', 'flor',
];

function categoryOrderIndex(category) {
  const norm = (category || '').toLowerCase();
  const idx = CATEGORY_ORDER.findIndex(k => norm.includes(k));
  return idx === -1 ? CATEGORY_ORDER.length : idx;
}

function sortCategories(categories) {
  return categories.slice().sort((a, b) => {
    const ia = categoryOrderIndex(a), ib = categoryOrderIndex(b);
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b, 'pt-BR');
  });
}

function quadrantCard(objectiveKey, row) {
  return `
    <div class="quad-card">
      <div class="quad-title">${OBJECTIVE_LABEL[objectiveKey] || objectiveKey}</div>
      ${row
        ? `${creativeHeader(row)}
           <div class="quad-body">${platformToggleWidget(row, objectiveKey)}</div>`
        : '<div class="quad-empty">Sem dados no período</div>'}
    </div>`;
}

async function tabCategorias() {
  loading();
  ensureCreativeModal();

  const rows = await supaRpc('get_categorias_best_creatives', { p_start: S.start, p_end: S.end });

  const categories = sortCategories([...new Set(rows.map(r => r.category))]);
  const byKey = {};
  rows.forEach(r => { byKey[`${r.category}||${r.state}||${r.objective_key}`] = r; });

  if (!categories.length) {
    document.getElementById('content').innerHTML = '<div class="card" style="padding:40px;text-align:center">Sem dados de campanhas de Categorias no período selecionado</div>';
    return;
  }

  let html = '';
  for (const category of categories) {
    const states = [...new Set(rows.filter(r => r.category === category).map(r => r.state))].sort();
    html += `<div class="category-section">
      <div class="category-title">${category}</div>`;
    for (const state of states) {
      html += `
        <div class="state-row">
          <div class="state-label">${state}</div>
          <div class="grid-2">
            ${quadrantCard('alcance', byKey[`${category}||${state}||alcance`])}
            ${quadrantCard('ig_profile', byKey[`${category}||${state}||ig_profile`])}
          </div>
        </div>`;
    }
    html += `</div>`;
  }

  document.getElementById('content').innerHTML = html;
}
