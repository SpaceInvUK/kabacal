// tools/strict-probe.mjs — decides Etapa 3 packaging: can the inline app script run under
// STRICT MODE (mandatory inside an ES module, i.e. a Deno Edge Function)? Regenerates the
// Plain Shaker golden with '"use strict"' prefixed; byte-equality = static packaging viable.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const src = html.match(/<script[^>]*>([\s\S]*?)<\/script>/i)[1];

const mkEl = () => { const el = { style: {}, dataset: {}, children: [], value: '', innerHTML: '', textContent: '', checked: false, options: [],
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  setAttribute() {}, getAttribute: () => null, appendChild(c) { el.children.push(c); return c; }, removeChild() {}, remove() {}, insertBefore() {},
  addEventListener() {}, removeEventListener() {}, focus() {}, select() {}, click() {}, closest: () => null,
  querySelector: () => mkEl(), querySelectorAll: () => [], getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
  scrollIntoView() {}, contains: () => false }; return el; };
const doc = { createElement: () => mkEl(), getElementById: () => mkEl(), querySelector: () => null, querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {}, body: mkEl(), documentElement: mkEl(), activeElement: null, write() {}, close() {} };
const mkStore = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() }; };
const win = { addEventListener() {}, removeEventListener() {}, open: () => null, matchMedia: () => ({ matches: false, addEventListener() {} }), location: { href: '', search: '', origin: 'http://x', reload() {} } };
win.window = win;
new Set([...html.matchAll(/id="([A-Za-z_$][\w$]*)"/g)].map(m => m[1])).forEach(id => { if (!(id in globalThis)) globalThis[id] = mkEl(); });

let api;
try {
  api = new Function('window', 'document', 'localStorage', 'sessionStorage', 'alert', 'confirm', 'prompt', 'navigator', 'location', 'fetch', 'setTimeout', 'clearTimeout',
    '"use strict";\n' + src + `;return { get items(){return items}, get camPaths(){return camPaths}, get camJob(){return camJob}, mkItem, applyProfile, render, clearSel, tplApply, tpSheets, tpSegsForSheet, ncPegasus }`)(
    win, doc, mkStore(), mkStore(), () => {}, () => true, () => null, { userAgent: 'node' }, win.location, () => Promise.reject(new Error('offline')), () => 0, () => {});
} catch (e) {
  console.error('STRICT BOOT FAILED: ' + (e && e.message));
  console.error((e && e.stack || '').split('\n').slice(0, 4).join('\n'));
  process.exit(1);
}

api.items.length = 0; api.clearSel(); api.camPaths.length = 0;
api.items.push(api.mkItem('flat', 600, 400, 1, 'MDF 18mm', '8x4', { t: 50, r: 50, b: 50, l: 50 }, null, 'PLAIN SHAKER', { on: false }, { offsetName: 'None' }));
api.applyProfile(0, 'Plain Shaker'); api.render();
api.camPaths.length = 0;
Object.assign(api.camJob, { zZero: 'bed', datum: 'll', rapidGap: 20, approach: 5, orient: 'portrait' });
api.tplApply('tpl_plainshaker18', true);
const nc = api.ncPegasus(api.tpSegsForSheet(api.tpSheets()[0]));
const gold = readFileSync(join(root, 'tests', 'golden', 'GOLDEN_PLAINSHAKER_S1_18mm.nc'), 'utf8');
console.log(nc === gold ? 'STRICT MODE OK — golden byte-identical under "use strict". Static ESM packaging is viable.'
  : `STRICT RAN but golden DIFFERS (${nc.length} vs ${gold.length} bytes)`);
process.exit(nc === gold ? 0 : 1);
