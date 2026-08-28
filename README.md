# economart-dashboard

Dashboard de Ads da Economart (Meta Ads, Google Ads e TikTok Ads) — frontend estático, servido via GitHub Pages.

100% client-side: `index.html`/`js`/`styles.css` consultam o Supabase direto do navegador (anon key, RLS só-leitura) via `js/config.js`. Sem backend próprio neste repositório — a sincronização dos dados (Meta Graph API, TikTok, Google Ads) continua rodando como Supabase Edge Function + `pg_cron`, fora deste repo.

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
```

## Origem

Migrado do Netlify (deploy manual via `netlify-cli`) para GitHub Pages. Só a hospedagem do front mudou — banco (Supabase, projeto `economart-ads-dashboard`), Edge Function de sync e regras de rateio por unidade permanecem os mesmos.
