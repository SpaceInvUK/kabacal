// tools/order-engine.mjs — headless Kabacal engine + kabacal-order/v1 adapter (doors-online Etapa 2).
//
// Runs the WHOLE index.html inline script in Node with DOM/storage stubs — the exact
// pattern proven by the check.mjs E2E sandbox (section 8). No index.html changes, no
// markers: the app itself IS the engine. Node-only for now: `new Function` gives the
// script its sloppy-mode semantics; packaging for Deno Deploy (Supabase Edge Functions,
// where runtime code-generation is blocked) is a build-step follow-up — see ROADMAP.
//
// API:
//   loadEngine()            → fresh app instance (own storage/DOM stubs)
//   orderToFiles(order)     → { fastcnc, dxf: {'18mm': str, …}, nc: [{name, content}], quote }
//     `order` = kabacal-order/v1 (docs/FASTCNC_DOORS_ONLINE_V1.md no repo cnc-calculator)
//
// v1 scope: kind 'door', style 'plain-shaker' (site product 2830), thickness 18/22.
// Frame defaults to 50mm — the value the Plain Shaker template + goldens were
// validated with (22mm Plain Shaker.nc reference). Confirm with production before
// offering other frames online.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const STYLE_PRESETS = { 'plain-shaker': 'Plain Shaker' };
const TPL_BY_TH = { 18: 'tpl_plainshaker18', 22: 'tpl_plainshaker22' };
const DEFAULT_FRAME = 50;

export function loadEngine() {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const src = (html.match(/<script[^>]*>([\s\S]*?)<\/script>/i) || [])[1] || '';
  if (!src) throw new Error('inline <script> not found in index.html');

  const mkEl = () => { const el = { style: {}, dataset: {}, children: [], value: '', innerHTML: '', textContent: '', checked: false, options: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {}, getAttribute: () => null, appendChild(c) { el.children.push(c); return c; }, removeChild() {}, remove() {}, insertBefore() {},
    addEventListener() {}, removeEventListener() {}, focus() {}, select() {}, click() {}, closest: () => null,
    querySelector: () => mkEl(), querySelectorAll: () => [], getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    scrollIntoView() {}, contains: () => false }; return el; };
  const doc = { createElement: () => mkEl(), getElementById: () => mkEl(), querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {}, body: mkEl(), documentElement: mkEl(), activeElement: null, write() {}, close() {} };
  const mkStore = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() }; };
  const ls = mkStore(), ss = mkStore();
  const win = { addEventListener() {}, removeEventListener() {}, open: () => null, matchMedia: () => ({ matches: false, addEventListener() {} }), location: { href: '', search: '', origin: 'http://x', reload() {} } };
  win.window = win;
  // browsers expose every id="…" as an implicit global — recreate that (same trick as check.mjs)
  new Set([...html.matchAll(/id="([A-Za-z_$][\w$]*)"/g)].map(m => m[1])).forEach(id => { if (!(id in globalThis)) globalThis[id] = mkEl(); });

  return new Function('window', 'document', 'localStorage', 'sessionStorage', 'alert', 'confirm', 'prompt', 'navigator', 'location', 'fetch', 'setTimeout', 'clearTimeout',
    src + `;return {
      get items(){return items}, get camPaths(){return camPaths}, get camJob(){return camJob},
      get project(){return project}, get panelRooms(){return panelRooms},
      mkItem, applyProfile, render, clearSel, tplApply, tpDefaults, tpSheets, tpSegsForSheet,
      ncPegasus, buildDxfByThickness, buildFastCnc, loadFastCnc, calcQuote,
      addTakeoffItems, parseTakeoffText, ensureOrderNumber
    }`)(win, doc, ls, ss, () => {}, () => true, () => null, { userAgent: 'node' }, win.location, () => Promise.reject(new Error('offline')), () => 0, () => {});
}

export function orderToFiles(order, opts = {}) {
  if (!order || order.schema !== 'kabacal-order/v1') throw new Error('expected a kabacal-order/v1 payload');
  const eng = opts.engine || loadEngine();
  const o = order.order, tag = 'FC-' + o.number;

  eng.items.length = 0; eng.clearSel(); eng.panelRooms.length = 0; eng.camPaths.length = 0;
  eng.project.client = `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim();
  eng.project.number = tag;
  eng.project.date = (o.created_gmt || '').slice(0, 10);
  eng.project.email = o.customer.email || '';
  eng.project.phone = o.customer.phone || '';
  eng.project.notes = (o.customer_note || '') && `Customer note: ${o.customer_note}`;

  const thicknesses = new Set();
  order.items.forEach((it, n) => {
    if (it.kind !== 'door') throw new Error(`item ${n}: v1 handles doors only (got ${it.kind})`);
    const preset = STYLE_PRESETS[it.style];
    if (!preset) throw new Error(`item ${n}: unsupported style "${it.style}" (v1: ${Object.keys(STYLE_PRESETS).join(', ')})`);
    if (!TPL_BY_TH[it.t_mm]) throw new Error(`item ${n}: unsupported thickness ${it.t_mm}mm`);
    thicknesses.add(it.t_mm);
    const holes = +it.hinge_holes || 0;
    const hinges = holes > 0
      ? { on: true, count: holes, side: /right/i.test(it.hinge_side || '') ? 'right' : 'left' }
      : { on: false };
    const f = DEFAULT_FRAME;
    eng.items.push(eng.mkItem('flat', it.w_mm, it.h_mm, it.qty, `MDF ${it.t_mm}mm`, '8x4',
      { t: f, r: f, b: f, l: f }, null, `${tag} ${it.name}`, hinges, { offsetName: 'None' }));
    eng.applyProfile(eng.items.length - 1, preset);
    if (it.cnc_notes) eng.project.notes += (eng.project.notes ? '\n' : '') + `Item ${n + 1} CNC notes: ${it.cnc_notes}`;
  });
  eng.render();

  // CAM — the exact pinned settings the Plain Shaker goldens were captured with.
  eng.camPaths.length = 0;
  Object.assign(eng.camJob, { zZero: 'bed', datum: 'll', rapidGap: 20, approach: 5, orient: 'portrait' });
  thicknesses.forEach(th => eng.tplApply(TPL_BY_TH[th], true));

  const sheets = eng.tpSheets();
  const nc = sheets.map((f, i) => ({
    name: `${tag}_S${i + 1}.nc`,
    content: eng.ncPegasus(eng.tpSegsForSheet(f)),
  }));
  const dxf = eng.buildDxfByThickness();
  const fastcnc = eng.buildFastCnc();
  const quote = eng.calcQuote();
  return { fastcnc, dxf, nc, quote };
}
