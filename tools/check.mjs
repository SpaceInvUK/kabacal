#!/usr/bin/env node
// Kabacal invariant checker — zero dependencies, runs anywhere node runs.
//
// Usage:
//   node tools/check.mjs          full check (syntax + invariants), exit 2 on failure
//   node tools/check.mjs --hook   PostToolUse hook mode: reads the hook JSON on stdin
//                                 and only checks when index.html was the edited file
//
// This is a tripwire, not a test suite: it catches broken JS and accidental
// edits to production-critical rules (pricing, DXF layers, NC post format).
// Runtime behaviour is verified separately with the /verify-kabacal skill.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'index.html');

// --hook mode: skip silently unless the edited file is index.html
if (process.argv.includes('--hook')) {
  let editedPath = '';
  try {
    const payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
    editedPath = (payload.tool_input && payload.tool_input.file_path) || '';
  } catch { /* no/invalid stdin -> treat as not index.html */ }
  if (!/index\.html$/i.test(editedPath)) process.exit(0);
}

const failures = [];
const must = (cond, msg) => { if (!cond) failures.push(msg); };

let html = '';
try { html = readFileSync(file, 'utf8'); }
catch (e) { failures.push('cannot read index.html: ' + e.message); }

if (html) {
  // 1. Structure: the app is one self-contained HTML file with ONE inline script
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  must(scripts.length === 1, `expected exactly 1 inline <script>, found ${scripts.length}`);

  // 2. Syntax: every script block must compile
  scripts.forEach((s, i) => {
    try { new Function(s); }
    catch (e) { failures.push(`script #${i + 1} does not compile: ${e.message}`); }
  });

  // 3. Pricing invariants (production rules — see CLAUDE.md "Guarded zones")
  const once = (re, label) => {
    const n = (html.match(re) || []).length;
    must(n === 1, `${label}: expected exactly 1 occurrence, found ${n}`);
  };
  once(/const PRICES=\{/g, 'PRICES table');
  once(/function calcQuote\(/g, 'calcQuote');
  once(/function priceForSheet\(/g, 'priceForSheet');
  once(/function cncForThickness\(/g, 'cncForThickness');
  must(html.includes('vat=Math.round(sub*0.2)'), 'VAT 20% rule missing (vat=Math.round(sub*0.2))');
  must(html.includes("size==='10x4')return 75"), "production price rule missing: MDF 18mm on 10x4 = 75");

  // 4. DXF layer contract (consumed by VCarve gadgets downstream)
  for (const layer of ['OFFCUT', 'OFFCUT_TEXT', 'GROOVE', 'SCRIBE', 'LED_CHANNEL', 'OFFSET_A',
                       'REEDED', 'BEADING', 'PART_NUMBER', 'INSIDE',
                       'OUT_10MM', 'IN_22MM', 'POKET_INSERT', 'SHADOW']) {
    must(html.includes(`'${layer}'`), `DXF layer missing from source: ${layer}`);
  }
  once(/const DXF_LAYERS=\{/g, 'DXF_LAYERS table');

  // 4b. Tool library: the embedded factory block must exist and keep the NC-validated t1
  must(/\/\*TOOLDB_START\*\/[\s\S]*\/\*TOOLDB_END\*\//.test(html), 'TOOL_FACTORY markers missing (tools/embed-tooldb.mjs)');
  must(html.includes('"id":"t1"'), 'factory tool t1 (the NC-validated 6mm cutter) missing');

  // 5. CNC post invariants (Pegasus/Syntec — validated vs the machine reference .nc)
  for (const tok of [":1248'", "'G40G17G80G49'", "'G53Z0'", "'M05M30'"]) {
    must(html.includes(tok), `NC post invariant missing: ${tok}`);
  }
  must(html.includes("join('\\r\\n')"), 'NC output must join lines with CRLF');

  // 6. Panels engine — behavioural tripwires (executed, not just grepped):
  //    40/40 joints, cross-wall shaker matching, 8x4/10x4 sheet caps, cross limit.
  const pnSrc = (html.match(/\/\*PN_ENGINE_START\*\/([\s\S]*?)\/\*PN_ENGINE_END\*\//) || [])[1];
  must(!!pnSrc, 'PN_ENGINE markers missing (panels engine)');
  must(html.includes('base.panelRooms='), 'buildFastCnc must save the additive panelRooms field');
  must(html.includes("localStorage.setItem('kab_panels'"), 'kab_panels persistence missing');
  if (pnSrc) {
    try {
      const api = new Function(pnSrc + ';return {pnLayoutRoom:pnLayoutRoom,PN_CAP:PN_CAP,PN_CROSS:PN_CROSS};')();
      const wall = o => Object.assign({ w: 2600, h: 3200, dir: 'h', sideL: 'normal', sideR: 'normal', shakerCount: 0, vRows: 2, vCols: 0, openings: [], panelOv: {} }, o);
      const room = (walls, o) => Object.assign({ name: '', mat: 'MDF 18mm', frame: 80, target: 350, doorAllow: 175, skirtOn: true, skirtH: 225, sillH: 22, hPanelH: 1030, vPanelH: 3000, sheetPref: 'auto', walls }, o || {});
      const near = (a, b, t) => Math.abs(a - b) <= (t == null ? 0.5 : t);
      { // chained walls: seam at the boundary, 40/40, last shaker of wall 1 == first shaker of wall 2
        const L = api.pnLayoutRoom(room([wall({ sideR: 'joint' }), wall({ sideL: 'joint' })]));
        const a = L.pieces.filter(p => p.wi === 0 && !p.isCap && !p.isLower).sort((x, y) => x.x0 - y.x0).pop();
        const b = L.pieces.filter(p => p.wi === 1 && !p.isCap && !p.isLower).sort((x, y) => x.x0 - y.x0)[0];
        must(!!(a && b), 'chain: expected band pieces on both walls');
        if (a && b) {
          must(near(a.x1, 2600, 1) && near(b.x0, 0, 1), 'chain: seam must sit at the wall boundary');
          must(near(a.sides.r.mm, 40) && near(b.sides.l.mm, 40), `chain: seam must split the 80 frame 40/40 (got ${a.sides.r.mm}/${b.sides.l.mm})`);
          const ca = a.cells[a.cells.length - 1], cb = b.cells[0];
          must(!!(ca && cb) && near(ca.w, cb.w, 0.6), `chain: seam shakers must match (got ${ca && ca.w} vs ${cb && cb.w})`);
        }
      }
      { // 2401–3000 stays ONE piece on 10x4; ≤2400 is ONE piece on 8x4
        const one = api.pnLayoutRoom(room([wall({ w: 2900 })])).pieces;
        must(one.length === 1 && one[0].sheet === '10x4', `2900 run must be one 10x4 piece (got ${one.length} × ${one[0] && one[0].sheet})`);
        const two = api.pnLayoutRoom(room([wall({ w: 2300 })])).pieces;
        must(two.length === 1 && two[0].sheet === '8x4', '2300 run must be one 8x4 piece');
      }
      { // long run: caps respected, every joint 40/40 with matching shakers both sides
        const ps = api.pnLayoutRoom(room([wall({ w: 6500 })])).pieces.sort((x, y) => x.x0 - y.x0);
        must(ps.length >= 3, '6500 run should split into >=3 pieces');
        ps.forEach(p => {
          must(Math.max(p.w, p.h) <= api.PN_CAP['10x4'] + 0.5, `piece over 10x4 cap: ${p.w}`);
          must(Math.min(p.w, p.h) <= api.PN_CROSS + 0.5, 'piece over sheet cross limit');
        });
        for (let i = 1; i < ps.length; i++) {
          must(near(ps[i - 1].sides.r.mm, 40) && near(ps[i].sides.l.mm, 40), 'internal joint must be 40/40');
          const ca = ps[i - 1].cells[ps[i - 1].cells.length - 1], cb = ps[i].cells[0];
          must(!!(ca && cb) && near(ca.w, cb.w, 0.6), `shakers must match across joint ${i}`);
        }
      }
      { // "8x4 only" preference caps pieces at 2400
        api.pnLayoutRoom(room([wall({ w: 2900 })], { sheetPref: '8x4' })).pieces.forEach(p =>
          must(p.w <= api.PN_CAP['8x4'] + 0.5, `8x4-only: piece over 2400 (${p.w})`));
      }
      { // vertical: columns <=1206 wide, 3000-tall pieces are 10x4
        const ps = api.pnLayoutRoom(room([wall({ dir: 'v', w: 5200 })])).pieces;
        must(ps.length >= 5, 'vertical 5200 wall needs >=5 columns');
        ps.forEach(p => { must(p.w <= api.PN_CROSS + 0.5, 'vertical column wider than 1206'); must(p.sheet === '10x4', '3000-tall vertical piece must be 10x4'); });
      }
    } catch (e) { failures.push('panels engine runtime check failed: ' + (e && e.message || e)); }
  }
}

if (failures.length) {
  console.error('KABACAL CHECK FAILED:\n - ' + failures.join('\n - '));
  process.exit(2);
}
console.log('kabacal check ok');
