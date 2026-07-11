#!/usr/bin/env node
// Kabacal SaaS — RLS isolation acceptance tests (supabase/README.md).
// Zero dependencies; node 18+ (global fetch). Creates two throwaway users (A/B),
// one account + one job each, then proves every cross-tenant path fails closed.
//
// Usage:
//   node tools/saas-isolation-test.mjs                  # local stack (reads `npx supabase status -o env`)
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… node tools/saas-isolation-test.mjs   # hosted
//
// The service-role key is used ONLY to create the two test users (admin API) —
// every actual test runs with anon/user JWTs, exactly like the app.
// Exit code 0 = all green. Non-zero = AT LEAST ONE ISOLATION FAILURE — do not ship.

import { execSync } from 'node:child_process';

function env() {
  let { SUPABASE_URL: url, SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service } = process.env;
  if (!url || !anon || !service) {
    const out = execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const get = (k) => (out.match(new RegExp(`^${k}="?([^"\\n]+)"?$`, 'm')) || [])[1];
    url = url || get('API_URL');
    anon = anon || get('ANON_KEY');
    service = service || get('SERVICE_ROLE_KEY');
  }
  if (!url || !anon || !service) { console.error('missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY (and no local stack found)'); process.exit(2); }
  return { url: url.replace(/\/$/, ''), anon, service };
}

const { url, anon, service } = env();
const results = [];
async function req(method, path, { token, key = anon, body, prefer } = {}) {
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (token !== null) headers.Authorization = `Bearer ${token || key}`;
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(url + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; const txt = await r.text();
  try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
  return { status: r.status, data };
}
function check(name, ok, detail) { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ← ' + detail}`); }

const ts = Date.now();
async function mkUser(tag) {
  const email = `iso-${tag}-${ts}@test.local`, password = 'Iso-test-1234!';
  const c = await req('POST', '/auth/v1/admin/users', { key: service, token: service, body: { email, password, email_confirm: true } });
  if (c.status >= 300) { console.error(`cannot create test user ${tag}:`, c.status, JSON.stringify(c.data)); process.exit(2); }
  const t = await req('POST', '/auth/v1/token?grant_type=password', { token: null, body: { email, password } });
  if (!t.data || !t.data.access_token) { console.error(`cannot sign in test user ${tag}:`, t.status, JSON.stringify(t.data)); process.exit(2); }
  return { email, id: c.data.id, jwt: t.data.access_token };
}

const A = await mkUser('a'), B = await mkUser('b');

// A and B each create their own shop (minimal return — see docs/SAAS.md trigger note) + one job + settings
async function mkShop(u, name) {
  const ins = await req('POST', '/rest/v1/accounts', { token: u.jwt, body: { name, owner_user_id: u.id } });
  if (ins.status >= 300) { console.error(`cannot create ${name}:`, ins.status, JSON.stringify(ins.data)); process.exit(2); }
  const acc = await req('GET', `/rest/v1/accounts?select=id,name&name=eq.${encodeURIComponent(name)}`, { token: u.jwt });
  const id = acc.data && acc.data[0] && acc.data[0].id;
  if (!id) { console.error(`cannot read back ${name} (trigger/select policy?)`); process.exit(2); }
  const job = await req('POST', '/rest/v1/jobs', { token: u.jwt, prefer: 'return=representation', body: { account_id: id, created_by: u.id, name: `job of ${name}`, job_json: { demo: name } } });
  const jobId = job.data && job.data[0] && job.data[0].id;
  if (!jobId) { console.error(`cannot create job for ${name}:`, job.status, JSON.stringify(job.data)); process.exit(2); }
  const st = await req('POST', '/rest/v1/account_settings', { token: u.jwt, body: { account_id: id, settings: { secret: name }, updated_by: u.id } });
  if (st.status >= 300) { console.error(`cannot create settings for ${name}:`, st.status, JSON.stringify(st.data)); process.exit(2); }
  return { id, jobId };
}
const shopA = await mkShop(A, `Iso Shop A ${ts}`), shopB = await mkShop(B, `Iso Shop B ${ts}`);

// sanity positives (prove RLS isn't just blocking everything)
{
  const own = await req('GET', `/rest/v1/jobs?select=id&account_id=eq.${shopA.id}`, { token: A.jwt });
  check('sanity: A sees own job', own.status === 200 && own.data.length === 1, `${own.status} ${JSON.stringify(own.data)}`);
}

// ---- the 9 fail-closed checks (as B against A's tenant, unless stated) ----
let r;
r = await req('GET', `/rest/v1/accounts?id=eq.${shopA.id}`, { token: B.jwt });
check('T1 B cannot read A account', r.status === 200 && r.data.length === 0, `${r.status} ${JSON.stringify(r.data)}`);

r = await req('GET', `/rest/v1/jobs?account_id=eq.${shopA.id}`, { token: B.jwt });
check('T2 B cannot list A jobs', r.status === 200 && r.data.length === 0, `${r.status} ${JSON.stringify(r.data)}`);

r = await req('POST', '/rest/v1/jobs', { token: B.jwt, body: { account_id: shopA.id, created_by: B.id, name: 'intruder', job_json: {} } });
check('T3 B cannot insert job into A', r.status === 403 || r.status === 401, `${r.status} ${JSON.stringify(r.data)}`);

r = await req('PATCH', `/rest/v1/jobs?id=eq.${shopA.jobId}`, { token: B.jwt, prefer: 'return=representation', body: { name: 'hacked' } });
check('T4 B cannot update A job', (r.status === 200 || r.status === 204) && (!Array.isArray(r.data) || r.data.length === 0), `${r.status} ${JSON.stringify(r.data)}`);

r = await req('PATCH', `/rest/v1/jobs?id=eq.${shopB.jobId}`, { token: B.jwt, body: { account_id: shopA.id } });
check('T5 B cannot move own job into A (column locked)', r.status === 403 || r.status === 401 || r.status === 400, `${r.status} ${JSON.stringify(r.data)}`);

r = await req('GET', `/rest/v1/account_settings?account_id=eq.${shopA.id}`, { token: B.jwt });
check('T6 B cannot read A settings', r.status === 200 && r.data.length === 0, `${r.status} ${JSON.stringify(r.data)}`);

r = await req('PATCH', `/rest/v1/accounts?id=eq.${shopB.id}`, { token: B.jwt, body: { plan: 'pro' } });
check('T7 B cannot self-upgrade plan (column locked)', r.status === 403 || r.status === 401 || r.status === 400, `${r.status} ${JSON.stringify(r.data)}`);

r = await req('DELETE', `/rest/v1/accounts?id=eq.${shopB.id}`, { token: B.jwt, prefer: 'return=representation' });
const still = await req('GET', `/rest/v1/accounts?id=eq.${shopB.id}`, { token: B.jwt });
check('T8 accounts cannot be client-deleted', still.status === 200 && still.data.length === 1, `del=${r.status} after=${JSON.stringify(still.data)}`);

r = await req('GET', '/rest/v1/jobs?select=id', { token: null }); // anon: apikey only, no user JWT
check('T9 anon reads nothing', r.status !== 200 || (Array.isArray(r.data) && r.data.length === 0), `${r.status} ${JSON.stringify(r.data)}`);

const bad = results.filter(x => !x.ok).length;
console.log(bad ? `\n${bad} FAILURE(S) — DO NOT SHIP / DO NOT INVITE USERS` : '\nall isolation checks green');
process.exit(bad ? 1 : 0);
