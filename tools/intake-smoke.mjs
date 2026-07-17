// tools/intake-smoke.mjs — runs the GENERATED order-intake handler in Node with a stubbed
// Supabase client + env, feeding the real order #4004 payload. Proves the deployable file
// (engine embedded, strict/ESM semantics) before it ever reaches Deno.
//
//   node tools/build-intake.mjs && node tools/intake-smoke.mjs

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let code = readFileSync(join(root, 'supabase', 'functions', 'order-intake', 'index.ts'), 'utf8');
code = code.replace(/^import .*$/m, '')                        // npm: import (Deno-only)
           .replace(/if \(typeof Deno[\s\S]*$/m, '')           // Deno.serve tail
           .replace(/^export /gm, '');
const mod = new Function(code + ';return { orderToFiles, handleOrderIntake };')();

const failures = [];
const must = (c, m) => { if (!c) { failures.push(m); console.error('  FAIL ' + m); } else console.log('  ok   ' + m); };

// ---- stub supabase client ----
const db = { rows: new Map(), uploads: [] };
const sb = {
  from: () => ({
    select: () => ({ eq: (_c, v) => ({ maybeSingle: async () => ({ data: db.rows.get(v) || null, error: null }) }) }),
    insert: async r => { db.rows.set(r.order_id, { ...r, status: 'received' }); return { error: null }; },
    update: r => ({ eq: async (_c, v) => { db.rows.set(v, { ...(db.rows.get(v) || {}), ...r }); return { error: null }; } }),
  }),
  storage: { from: () => ({ upload: async (path, blob) => { db.uploads.push({ path, size: blob.size }); return { error: null }; } }) },
};
const env = { get: k => ({ FCNC_BRIDGE_SECRET: 'test-secret-123' }[k]) };

const payload = {
  schema: 'kabacal-order/v1', source: 'woocommerce', site_url: 'https://fast-cnc-test.local', bridge_version: '1.0.0',
  order: { id: 4004, number: '4004', status: 'processing', currency: 'GBP', total: '136.00',
    created_gmt: '2026-07-17T07:12:00Z', payment_method: 'cod', transaction_id: '', customer_note: '',
    customer: { first_name: 'Joao', last_name: 'Teste', email: 'cliente.teste@example.com', phone: '07510000000',
      billing_address: '1 Test Street, Upminster, RM14 1TP, GB', shipping_address: '1 Test Street, Upminster, RM14 1TP, GB' } },
  items: [{ product_id: 2830, name: 'Plain Shaker', kind: 'door', style: 'plain-shaker', qty: 2,
    h_mm: 600, w_mm: 400, t_mm: 18, finish: 'Primed white', hinge_holes: 2, hole_positions: 'Standard',
    hinge_side: 'Left', soft_close_hinges: 0, cnc_notes: 'TEST', unit_price: '68.00', line_total: '136.00', prep_cost: '0.00' }],
};
const mkReq = (body, secret) => new Request('http://x/order-intake', {
  method: 'POST', headers: { 'content-type': 'application/json', ...(secret ? { 'x-fcnc-secret': secret } : {}) },
  body: JSON.stringify(body),
});

console.log('generated handler: auth');
{
  const r = await mod.handleOrderIntake(mkReq(payload, 'wrong'), { sb, env });
  must(r.status === 401, `wrong secret -> 401 (got ${r.status})`);
}
console.log('generated handler: happy path (real #4004)');
{
  const r = await mod.handleOrderIntake(mkReq(payload, 'test-secret-123'), { sb, env });
  const j = await r.json();
  must(r.status === 200 && j.ok === true, `200 ok (got ${r.status} ${JSON.stringify(j).slice(0, 120)})`);
  must(Array.isArray(j.files) && j.files.length === 3, `3 files: fastcnc + dxf + nc (got ${j.files && j.files.length})`);
  must(db.uploads.length === 3 && db.uploads.every(u => u.path.startsWith('orders/FC-4004/')), 'uploads under orders/FC-4004/');
  must(/skipped/.test(j.email), `email skipped without RESEND_API_KEY (got ${j.email})`);
  must(db.rows.get(4004).status === 'files_generated', 'row status -> files_generated');
  const nc = j.files.find(f => f.name.endsWith('.nc'));
  must(nc && nc.bytes > 1000, `NC has substance (${nc && nc.bytes} bytes)`);
}
console.log('generated handler: idempotency');
{
  const r = await mod.handleOrderIntake(mkReq(payload, 'test-secret-123'), { sb, env });
  const j = await r.json();
  must(r.status === 200 && j.duplicate === true, 'second delivery -> duplicate:true, nothing regenerated');
}

if (failures.length) { console.error(`\n${failures.length} FAILURE(S)`); process.exit(1); }
console.log('\nALL GREEN — generated order-intake works end-to-end in Node.');
