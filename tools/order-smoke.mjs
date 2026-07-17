// tools/order-smoke.mjs — proof that the headless order engine produces machine-true output.
//
//   node tools/order-smoke.mjs
//
// (1) GOLDEN PARITY — regenerates two committed goldens through order-engine's sandbox
//     and byte-compares: GOLDEN_PLAINSHAKER_S1_18mm.nc (recipe in tests/golden/README.md)
//     and GOLDEN_18mm.dxf (standard job). Any diff = the headless path is NOT the app = fail.
// (2) ORDER FIXTURE — feeds the real WooCommerce test order #4004 (kabacal-order/v1, captured
//     from the site bridge on 2026-07-17) through orderToFiles() and asserts the outputs.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine, orderToFiles } from './order-engine.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const must = (cond, msg) => { if (!cond) { failures.push(msg); console.error('  FAIL ' + msg); } else { console.log('  ok   ' + msg); } };
const golden = f => readFileSync(join(root, 'tests', 'golden', f), 'utf8');

// ---------- (1a) Plain Shaker 18mm NC golden, byte-for-byte ----------
console.log('golden parity: GOLDEN_PLAINSHAKER_S1_18mm.nc');
{
  const eng = loadEngine();
  eng.items.length = 0; eng.clearSel(); eng.panelRooms.length = 0; eng.camPaths.length = 0;
  eng.items.push(eng.mkItem('flat', 600, 400, 1, 'MDF 18mm', '8x4', { t: 50, r: 50, b: 50, l: 50 }, null, 'PLAIN SHAKER', { on: false }, { offsetName: 'None' }));
  eng.applyProfile(0, 'Plain Shaker'); eng.render();
  eng.camPaths.length = 0;
  Object.assign(eng.camJob, { zZero: 'bed', datum: 'll', rapidGap: 20, approach: 5, orient: 'portrait' });
  eng.tplApply('tpl_plainshaker18', true);
  const nc = eng.ncPegasus(eng.tpSegsForSheet(eng.tpSheets()[0]));
  must(nc === golden('GOLDEN_PLAINSHAKER_S1_18mm.nc'), `NC byte-identical (${nc.length} bytes)`);
}

// ---------- (1b) Standard-job DXF golden, byte-for-byte ----------
console.log('golden parity: GOLDEN_18mm.dxf');
{
  const eng = loadEngine();
  eng.items.length = 0; eng.clearSel();
  eng.project.client = 'GOLDEN'; eng.project.number = 'GOLDEN'; eng.project.date = '2026-01-01';
  eng.project.phone = ''; eng.project.email = ''; eng.project.notes = '';
  eng.addTakeoffItems(eng.parseTakeoffText('600 x 400 x 6\n715 x 495 x 2\n300 x 300 x 4'));
  eng.render();
  const dxf = eng.buildDxfByThickness()['18mm'];
  must(dxf === golden('GOLDEN_18mm.dxf'), `DXF byte-identical (${(dxf || '').length} bytes)`);
}

// ---------- (2) Real order #4004 through the v1 adapter ----------
console.log('order fixture: WooCommerce #4004 (2x Plain Shaker 600x400x18, 2 hinge holes left)');
{
  const order = {
    schema: 'kabacal-order/v1', source: 'woocommerce', site_url: 'https://fast-cnc-test.local', bridge_version: '1.0.0',
    order: {
      id: 4004, number: '4004', status: 'processing', currency: 'GBP', total: '136.00',
      created_gmt: '2026-07-17T07:12:00Z', payment_method: 'cod', transaction_id: '', customer_note: '',
      customer: { first_name: 'Joao', last_name: 'Teste', email: 'cliente.teste@example.com', phone: '07510000000',
        billing_address: '1 Test Street, Upminster, RM14 1TP, GB', shipping_address: '1 Test Street, Upminster, RM14 1TP, GB' },
    },
    items: [{ product_id: 2830, name: 'Plain Shaker', kind: 'door', style: 'plain-shaker', qty: 2,
      h_mm: 600, w_mm: 400, t_mm: 18, finish: 'Primed white', hinge_holes: 2, hole_positions: 'Standard',
      hinge_side: 'Left', soft_close_hinges: 0, cnc_notes: 'TEST ORDER - automated end-to-end test by Claude. Do NOT produce.',
      unit_price: '68.00', line_total: '136.00', prep_cost: '0.00' }],
  };
  const out = orderToFiles(order);
  must(out.quote.partN === 2, `quote counts 2 parts (got ${out.quote.partN})`);
  must(out.nc.length === 1, `1 sheet -> 1 NC file (got ${out.nc.length})`);
  must(out.nc[0].content.length > 1000, `NC has substance (${out.nc[0].content.length} bytes)`);
  must(/T1[^0-9]/.test(out.nc[0].content) && /T12/.test(out.nc[0].content) && /T2[^0-9]/.test(out.nc[0].content),
    'NC carries the Plain Shaker segments (T12 skim / T1 / T2)');
  must(!!out.dxf['18mm'] && out.dxf['18mm'].includes('hinges'), 'DXF 18mm exists and carries the hinges layer');
  must(Array.isArray(out.fastcnc.blocks) && out.fastcnc.blocks.length >= 1, '.fastcnc has blocks');
  const parts = out.fastcnc.blocks.flatMap(b => b.parts || []);
  must(parts.length === 1 && +parts[0].quantity === 2, `.fastcnc carries 1 part line, qty 2 (got ${parts.length}/${parts[0] && parts[0].quantity})`);
  const eng2 = loadEngine();
  eng2.loadFastCnc(JSON.parse(JSON.stringify(out.fastcnc)));
  must(eng2.items.length === 1 && eng2.items[0].q === 2 && eng2.items[0].w === 400 && eng2.items[0].h === 600,
    '.fastcnc round-trip: reloads as 1 item 400x600 q2');
  console.log(`  sizes: NC=${out.nc[0].content.length}B DXF18=${out.dxf['18mm'].length}B fastcnc=${JSON.stringify(out.fastcnc).length}B quote total £${out.quote.total}`);
}

if (failures.length) { console.error(`\n${failures.length} FAILURE(S)`); process.exit(1); }
console.log('\nALL GREEN — headless order engine matches the app byte-for-byte.');
