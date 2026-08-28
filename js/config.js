const SURL = 'https://ygnmahqprqlvhedjvskf.supabase.co';
const SKEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlnbm1haHFwcnFsdmhlZGp2c2tmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MzgzMjQsImV4cCI6MjA5OTMxNDMyNH0.TZ_2Ryj93Nakm8-gZ3Obfqi14m__JG_Rui6lMBzONRU';

async function supa(path) {
  const r = await fetch(`${SURL}/rest/v1/${path}`, {
    headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, Range: '0-49999' }
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

async function supaRpc(fn, params) {
  const r = await fetch(`${SURL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!r.ok) throw new Error(`Supabase RPC ${fn} ${r.status}: ${await r.text()}`);
  return r.json();
}
