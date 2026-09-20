# economart-dashboard

Dashboard de Ads da Economart (Meta Ads, Google Ads e TikTok Ads) — frontend estático, servido via GitHub Pages.

O frontend é client-side: `index.html`/`js`/`styles.css` consultam o Supabase direto do navegador (anon key, RLS só-leitura) via `js/config.js`. As migrações SQL e Edge Functions mantidas pelo projeto também ficam versionadas neste repositório.

A aba **Públicos Meta** separa mídia paga e Instagram orgânico. Na visão orgânica, além do perfil demográfico dos seguidores, o dashboard mostra os totais consolidados do período, a evolução diária disponível e a tabela de posts com alcance e engajamento. A função `sync-economart-instagram-content` atualiza esses dados diariamente no Supabase.

## Estrutura

```
index.html
styles.css
js/
  config.js      # URL + anon key do Supabase, helpers supa()/supaRpc()
  utils.js
  app.js         # estado global, filtros de período, troca de aba
  tabs/
    categorias.js
    comunidade.js
    top.js
    orcamento.js
    tiktok.js
sql/              # migrações aplicadas ao Supabase
supabase/
  functions/      # Edge Functions de sincronização versionadas
```

## Origem

Migrado do Netlify para GitHub Pages. O banco e as rotinas de sincronização permanecem no Supabase (projeto `economart-ads-dashboard`).

## Ranking de melhores anúncios

As abas Categorias, Comunidade e Top Criativos classificam anúncios individuais (`ad_id`), com recálculo independente para Geral, Facebook e Instagram. Para alcance, o ranking usa o valor consolidado do período retornado pela Meta; quando esse snapshot ainda não existe, usa impressões como fallback e nunca soma alcances diários.
