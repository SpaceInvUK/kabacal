#!/usr/bin/env node
// Kabacal invariant checker — zero dependencies, runs anywhere node runs.
//
// Usage:
//   node tools/check.mjs               full check (syntax + invariants), exit 2 on failure
//   node tools/check.mjs --hook        PostToolUse hook mode: reads the hook JSON on stdin
//                                      and only checks when index.html was the edited file
//   node tools/check.mjs --pre-commit  full check + git-aware rules (run by .githooks/pre-commit):
//                                      index.html staged without ROADMAP.md = FAIL;
//                                      guarded functions in staged diff without tests/golden/* staged = WARN
//
// This is a tripwire, not a test suite: it catches broken JS and accidental
// edits to production-critical rules (pricing, DXF layers, NC post format).
// Runtime behaviour is verified separately — see docs/TESTING.md.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

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
  // Panels DXF export must exist and follow the Doors layer discipline
  once(/function pnDxfForThickness\(/g, 'pnDxfForThickness (panels DXF writer)');
  once(/function pnBuildDxfByThickness\(/g, 'pnBuildDxfByThickness');
  once(/function pnDownloadDxf\(/g, 'pnDownloadDxf');
  must(html.includes("'PANELS_'+th"), 'panels DXF files must be named PANELS_<thickness>');
  must(html.includes("cncRate=(room.cncCost!=null&&room.cncCost!=='')?+room.cncCost:330"), 'panels CNC default £330/sheet missing');
  if (pnSrc) {
    try {
      const api = new Function(pnSrc + ';return {pnLayoutRoom:pnLayoutRoom,PN_CAP:PN_CAP,PN_CROSS:PN_CROSS,pnPlanCompile:pnPlanCompile,pnPlanLen:pnPlanLen,PN_WALL_T:PN_WALL_T,PN_PANEL_T:PN_PANEL_T};')();
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
          must(a.name === 'Wall 1A' && b.name === 'Wall 2A', `panel names must be "Wall <n><letter>" (got ${a.name} / ${b.name})`);
          must(a.vn === 1 && b.vn === 2, 'visual sequence numbers (vn) must follow layout order');
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
      { // per-panel overrides (2026-07-08): height / orientation / cols×rows / frame — edited panel only
        const base = api.pnLayoutRoom(room([wall({ w: 6500 })])).pieces.sort((x, y) => x.x0 - y.x0);
        must(base.length >= 3, 'override test needs >=3 pieces');
        const pid = base[1].pid;
        const othersBefore = [base[0], base[2]].map(p => (p.cells || []).length + ':' + Math.round(p.x0) + '-' + Math.round(p.x1)).join('|');
        const ps = api.pnLayoutRoom(room([wall({ w: 6500, panelOv: { [pid]: { h: 800, dir: 'v', cols: 3, rows: 2, frame: 60 } } })])).pieces.sort((x, y) => x.x0 - y.x0);
        const ed = ps.find(p => p.pid === pid);
        must(!!ed && Math.abs(ed.h - 800) < 0.6, 'panelOv.h must set the panel height (got ' + (ed && ed.h) + ')');
        must(ed.cells.length === 6, 'panelOv dir=v cols=3 rows=2 must give 6 cells (got ' + ed.cells.length + ')');
        must([...new Set(ed.cells.map(c => Math.round(c.y)))].length === 2, 'panelOv rows=2 must give 2 cell bands');
        const othersAfter = [ps[0], ps[2]].map(p => (p.cells || []).length + ':' + Math.round(p.x0) + '-' + Math.round(p.x1)).join('|');
        must(othersAfter === othersBefore, 'neighbour panels must be untouched by a per-panel override');
        const pc = api.pnLayoutRoom(room([wall({ w: 2300, panelOv: { 'w0p1': { h: 9999 } } })])).pieces[0];
        must(pc.h <= api.PN_CROSS + 0.5 && /clamped/.test(pc.ovNote || ''), 'oversize panel height must clamp WITH a visible note');
      }
      { // skirting (2026-07-08): per-wall override changes ONLY that wall's ground band; room default unchanged; notes are inert
        const bandBottom = pcs => Math.round(Math.min(...pcs.filter(p => p.y0 <= 0.5 && !p.isCap).map(p => p.sides.b)));
        const roomDef = api.pnLayoutRoom(room([wall({ w: 2300 }), wall({ w: 2300 })]));
        const b0 = bandBottom(roomDef.pieces.filter(p => p.wi === 0)), b1 = bandBottom(roomDef.pieces.filter(p => p.wi === 1));
        must(b0 === 305 && b1 === 305, `default skirting: ground band bottom must be 225+80=305 (got ${b0}/${b1})`);
        const mixed = api.pnLayoutRoom(room([wall({ w: 2300 }), wall({ w: 2300, skirt: { mode: 'custom', on: true, h: 150 } }), wall({ w: 2300, skirt: { mode: 'custom', on: false } })]));
        must(bandBottom(mixed.pieces.filter(p => p.wi === 0)) === 305, 'wall without override keeps room skirting (305)');
        must(bandBottom(mixed.pieces.filter(p => p.wi === 1)) === 230, 'wall skirt 150 → band bottom 150+80=230');
        must(bandBottom(mixed.pieces.filter(p => p.wi === 2)) === 80, 'wall skirt off → band bottom = frame only (80)');
        const geomA = JSON.stringify(api.pnLayoutRoom(room([wall({ w: 3000 })])).pieces.map(p => [p.x0, p.x1, p.y0, p.y1, p.cells.length]));
        const geomB = JSON.stringify(api.pnLayoutRoom(room([wall({ w: 3000, notes: ['note one', 'note two'], panelNotes: { w0p1: ['x'] } })])).pieces.map(p => [p.x0, p.x1, p.y0, p.y1, p.cells.length]));
        must(geomA === geomB, 'notes must not change any geometry');
      }
      { // vertical ZONE (2026-07-08): one panel → physical vertical (≤1200×≤3000, 10x4); wall auto-refills; mixed OK
        const plain = api.pnLayoutRoom(room([wall({ w: 5000 })])).pieces;
        must(plain.every(p => p.dir === 'h'), 'wall without a zone must be all horizontal');
        const L = api.pnLayoutRoom(room([wall({ w: 5000, vZones: [{ id: 'z1', x: 2000, w: 1000, h: 3000, cols: 0, rows: 2 }] })]));
        const vz = L.pieces.filter(p => p.isZone);
        must(vz.length === 1, 'exactly one vertical zone piece expected (got ' + vz.length + ')');
        const z = vz[0];
        must(z.dir === 'v' && Math.abs(z.w - 1000) < 0.6 && Math.abs(z.h - 3000) < 0.6, `zone must be 1000×3000 vertical (got ${z.w}×${z.h})`);
        must(z.sheet === '10x4', '3000-tall zone must be a 10x4 piece');
        must(z.cells.length >= 2 && [...new Set(z.cells.map(c => Math.round(c.y)))].length === 2, 'zone rows=2 → two cell bands');
        must(Math.abs(z.sides.l.mm - 40) < 0.01 && Math.abs(z.sides.r.mm - 40) < 0.01, 'zone joints must be 40/40 to the refilled band');
        const band = L.pieces.filter(p => p.wi === 0 && !p.isZone);
        must(band.length >= 2 && band.every(p => p.dir === 'h'), 'the rest of the wall must auto-refill with horizontal panels');
        must(band.some(p => p.x1 <= z.x0 + 0.6) && band.some(p => p.x0 >= z.x1 - 0.6), 'horizontal panels must sit on BOTH sides of the vertical panel');
        const wide = api.pnLayoutRoom(room([wall({ w: 5000, vZones: [{ id: 'z2', x: 100, w: 1600, h: 3500 }] })])).pieces.find(p => p.isZone);
        must(wide.w <= 1200.6 && wide.h <= 3000.6, `zone must clamp to 1200×3000 (got ${wide.w}×${wide.h})`);
        const noZoneGeom = JSON.stringify(plain.map(p => [Math.round(p.x0), Math.round(p.x1)]));
        const stillPlain = JSON.stringify(api.pnLayoutRoom(room([wall({ w: 5000, vZones: [] })])).pieces.map(p => [Math.round(p.x0), Math.round(p.x1)]));
        must(noZoneGeom === stillPlain, 'empty vZones array must equal no-zone geometry (byte-identical safety)');
      }
      { // 2D room builder: compilePlan (2026-07-08) — plan is the source, walls derived; safe + preserving
        must(typeof api.pnPlanCompile === 'function', 'pnPlanCompile must be exported from PN_ENGINE');
        must(api.PN_WALL_T === 150 && api.PN_PANEL_T === 22, 'plan defaults must be wall 150 / panel 22');
        // no plan → walls untouched (manual rooms + goldens safe)
        const manual = room([wall({ w: 2600 })]);
        must(api.pnPlanCompile(manual) === manual.walls, 'no plan → room.walls returned unchanged (same ref)');
        // one wall from two nodes 3000 apart
        const p1 = { nodes: [{ id: 'n1', x: 0, y: 0 }, { id: 'n2', x: 3000, y: 0 }], edges: [{ id: 'e1', a: 'n1', b: 'n2', height: 3200 }] };
        const w1 = api.pnPlanCompile({ mat: 'MDF 18mm', walls: [], plan: p1 });
        must(w1.length === 1 && w1[0].w === 3000 && w1[0].h === 3200 && w1[0].id === 'pe_e1', `1-wall plan → 3000×3200 wall (got ${w1[0] && w1[0].w})`);
        must(api.pnLayoutRoom(room(w1)).pieces.length >= 1, 'compiled wall must feed the layout engine');
        // three connected walls (shared nodes) → three walls with the right lengths
        const p3 = { nodes: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 4000, y: 0 }, { id: 'c', x: 4000, y: 3000 }, { id: 'd', x: 0, y: 3000 }],
          edges: [{ id: 'e1', a: 'a', b: 'b' }, { id: 'e2', a: 'b', b: 'c' }, { id: 'e3', a: 'c', b: 'd' }] };
        const w3 = api.pnPlanCompile({ mat: 'MDF 18mm', walls: [], plan: p3 });
        must(w3.length === 3 && w3[0].w === 4000 && w3[1].w === 3000 && w3[2].w === 4000, 'three connected walls → 4000/3000/4000');
        // preserve prior wall settings by id across recompile; plan drives size
        const prevRoom = { mat: 'MDF 18mm', walls: [{ id: 'pe_e1', w: 999, h: 999, dir: 'v', shakerCount: 5, skirt: { mode: 'custom', on: false } }], plan: p1 };
        const w1b = api.pnPlanCompile(prevRoom)[0];
        must(w1b.w === 3000 && w1b.dir === 'v' && w1b.shakerCount === 5 && w1b.skirt && w1b.skirt.on === false, 'recompile preserves dir/shaker/skirt by id, size from plan');
        // plan opening compiles onto the edge's wall
        const pOp = { nodes: p1.nodes, edges: p1.edges, openings: [{ id: 'o1', edgeId: 'e1', type: 'door', offset: 800, width: 900, height: 2100 }] };
        const wOp = api.pnPlanCompile({ mat: 'MDF 18mm', walls: [], plan: pOp })[0];
        must(wOp.openings.length === 1 && wOp.openings[0].type === 'door' && wOp.openings[0].w === 900 && wOp.openings[0].x === 800, 'plan opening compiles into wall.openings');
      }
    } catch (e) { failures.push('panels engine runtime check failed: ' + (e && e.message || e)); }
  }

  // 7. Doors-side engines — marker-extracted like PN_ENGINE and EXECUTED (Phase 4).
  const grab = name => (html.match(new RegExp('/\\*' + name + '_START\\*/([\\s\\S]*?)/\\*' + name + '_END\\*/')) || [])[1];
  const nestSrc = grab('NEST_ENGINE'), offSrc = grab('OFFCUT_ENGINE'), camSrc = grab('CAM_ENGINE');
  must(!!nestSrc, 'NEST_ENGINE markers missing');
  must(!!offSrc, 'OFFCUT_ENGINE markers missing');
  must(!!camSrc, 'CAM_ENGINE markers missing');

  // 7a. MaxRects nesting: conservation, bounds, no overlaps, sheet count for the standard job
  if (nestSrc) {
    try {
      const api = new Function('sheetMeta', 'grainActive', 'rigidOrient', 'isHost',
        nestSrc + ';return {mrInsert, mrNewBin, mrPackBins, autoPack, packInto};')(
        () => ({ sz: '8x4', S: { w: 2440, h: 1220 }, g: 7, margin: 7 }),   // stub: default 8x4, 7mm margin/gap
        () => false, p => ({ w: p.w, h: p.h }), () => false);
      const parts = []; let k = 0;
      const mk = (w, h, n) => { for (let i = 0; i < n; i++) parts.push({ key: String(k++), w, h }); };
      mk(600, 400, 6); mk(715, 495, 2); mk(300, 300, 4);                    // the standard job
      const bins = api.autoPack('MDF 18mm', parts);
      const tot = bins.reduce((a, b) => a + b.parts.length, 0);
      must(tot === 12, `nest: part conservation broken (12 in, ${tot} out)`);
      must(bins.length === 2, `nest: standard job must pack on 2 sheets (got ${bins.length})`);
      const ov = (a, b) => a.x < b.x + b.w - 0.01 && a.x + a.w > b.x + 0.01 && a.y < b.y + b.h - 0.01 && a.y + a.h > b.y + 0.01;
      bins.forEach((s, si) => s.parts.forEach((p, i) => {
        must(p.x >= 6.99 && p.y >= 6.99 && p.x + p.w <= 2433.01 && p.y + p.h <= 1213.01, `nest: part outside margins on sheet ${si}`);
        for (let j = i + 1; j < s.parts.length; j++) must(!ov(p, s.parts[j]), `nest: parts overlap on sheet ${si}`);
      }));
      must(api.packInto({ sz: '8x4', S: { w: 2440, h: 1220 }, g: 7, margin: 7 }, parts.slice(0, 5)).length === 5,
        'nest: packInto must keep all parts (sheet membership repack)');
    } catch (e) { failures.push('nest engine runtime check failed: ' + (e && e.message || e)); }
  }

  // 7b. Offcuts: the NORMATIVE examples from KABACAL_RULES.md + outline/L geometry
  if (offSrc) {
    try {
      const api = new Function(offSrc + ';return {offcutUsable, offcutEdges, offcutCross};')();
      [[350, 600, true], [250, 700, false], [124, 900, false], [120, 1600, true],
       [190, 1060, false], [256, 1586, true], [211, 1625, true], [503, 435, true]]
        .forEach(([w, h, exp]) => must(api.offcutUsable(w, h) === exp, `offcutUsable(${w},${h}) must be ${exp}`));
      must(api.offcutEdges([{ x: 0, y: 0, w: 100, h: 50 }]).length === 4, 'offcut: plain rect outline must have 4 edges');
      const Lsegs = api.offcutEdges([{ x: 0, y: 0, w: 200, h: 50 }, { x: 150, y: 0, w: 50, h: 150 }]);
      const len = Lsegs.reduce((a, s) => a + Math.abs(s[2] - s[0]) + Math.abs(s[3] - s[1]), 0);
      must(Lsegs.length === 8 && len === 700, `offcut: L outline must be 8 grid segments / 700mm perimeter (got ${Lsegs.length}/${len})`);
      must(!Lsegs.some(s => s[0] === 150 && s[2] === 150 && s[3] <= 50), 'offcut: internal L joint must be removed from the outline');
      must(api.offcutCross({ x: 0, y: 0, w: 200, h: 50 }, { x: 150, y: 0, w: 50, h: 150 }) === true, 'offcut: corner-overlap L must be accepted');
      must(api.offcutCross({ x: 0, y: 0, w: 200, h: 50 }, { x: 80, y: 0, w: 40, h: 150 }) === false, 'offcut: T shape must be rejected');
      must(api.offcutCross({ x: 0, y: 0, w: 200, h: 200 }, { x: 50, y: 50, w: 50, h: 50 }) === false, 'offcut: containment must be rejected');
    } catch (e) { failures.push('offcut engine runtime check failed: ' + (e && e.message || e)); }
  }

  // 7c. CAM geometry + Syntec post (contract: docs/CONTRACT-CAM.md)
  if (camSrc) {
    try {
      const cj = { zZero: 'bed', datum: 'll', orient: 'portrait', rapidGap: 20, approach: 5 };
      const api = new Function('camJob', camSrc + ';return {ringPts, tpPartMoves, tpOrientDims, tpDatumOff, tpXform, ncPegasus};')(cj);
      const S = { w: 2440, h: 1220 }, part = { x: 7, y: 7, w: 600, h: 1000 };
      const ring = api.ringPts(part, S, 3, 'll');
      must(ring.length === 8 && ring[0].x === 4 && ring[0].y === 210, `cam: ring ll anchor must be (4,210), got (${ring[0].x},${ring[0].y})`);
      must(ring[1].x === 307 && ring[1].y === 210, 'cam: ring must run CCW (second point = lower-centre)');
      const P = { startDepth: 0, cutDepth: null, passDepth: 6, passes: null, side: 'outside', allowance: 0,
                  lastPass: { on: true, val: 0.4 }, addDepth: { on: false, val: 0.2 }, tabs: { on: false },
                  ramp: { on: true, dist: 100 }, order: 'narrow', startAt: 'll' };
      const tool = { dia: 6, feed: 8000, plunge: 3000, rpm: 18000, passDepth: 6 };
      const mv = []; api.tpPartMoves(mv, part, S, P, tool, 18);
      mv.forEach(m => { if (m.r && m.z !== undefined) must(m.z >= 23 - 1e-6, `cam: rapid at Z${m.z} below approach height`); });
      const zs = mv.filter(m => !m.r && m.z !== undefined).map(m => m.z);
      must(Math.min(...zs) === 0, 'cam: final floor must be exactly Z0 (bed zero, cutDepth = thickness)');
      must(zs.some(z => z === 12) && zs.some(z => z === 6), 'cam: 6mm pass ladder (12/6/0) missing');
      const firstF = mv.find(m => m.f !== undefined);
      must(firstF && firstF.f === 3000, 'cam: first feed move must be at plunge feed');
      must(mv.some(m => m.f === 8000), 'cam: cutting feed missing');
      const D = api.tpOrientDims(S);
      must(D.W === 1220 && D.H === 2440, 'cam: portrait machine dims must be 1220x2440');
      cj.datum = 'c'; const dc = api.tpDatumOff(D); cj.datum = 'll';
      must(dc[0] === 610 && dc[1] === 1220, 'cam: centre datum offset must be (610,1220)');
      const xf = api.tpXform([{ x: 7, y: 7 }], S);
      must(xf[0].x === 1213 && xf[0].y === 7, `cam: portrait transform of (7,7) must be (1213,7), got (${xf[0].x},${xf[0].y})`);
      const nc = api.ncPegasus([
        { num: 1, rpm: 18000, moves: [{ r: 1, z: 38 }, { r: 1, x: 4, y: 210 }, { x: 4, y: 210, z: 12, f: 3000 }, { x: 100, y: 210, f: 8000 }] },
        { num: 2, rpm: 16000, moves: [{ r: 1, z: 38 }] }]);
      must(nc.startsWith('%\r\n:1248\r\nG90\r\nN30G0X0Y0\r\nN40G40G17G80G49\r\nN50T1M6'), 'cam: NC header drifted');
      must(nc.includes('\r\nN') && nc.includes('G53Z0\r\n') && nc.includes('T2M06'), 'cam: toolchange block (G53Z0 + T2M06) missing');
      must(nc.endsWith('M05M30\r\n'), 'cam: NC footer must end M05M30 + CRLF');
      must(nc.includes('S18000M3') && nc.includes('S16000M3'), 'cam: per-segment spindle speeds missing');
    } catch (e) { failures.push('cam engine runtime check failed: ' + (e && e.message || e)); }
  }
}

// --pre-commit: git-aware rules on top of the full check (wired via .githooks/pre-commit)
if (process.argv.includes('--pre-commit')) {
  try {
    const git = cmd => execSync('git ' + cmd, { cwd: root, maxBuffer: 64 * 1024 * 1024 }).toString();
    const staged = git('diff --cached --name-only').trim().split(/\r?\n/).filter(Boolean);
    if (staged.includes('index.html')) {
      // House rule: every app change ships with a dated ROADMAP entry.
      must(staged.includes('ROADMAP.md'),
        'index.html is staged without ROADMAP.md — add the dated entry (top of ROADMAP.md) and stage it too');
      // Guarded-zone tripwire: warn when guarded functions appear in ADDED lines but no goldens are staged.
      const GUARDED = ['calcQuote', 'priceForSheet', 'cncForThickness', 'sprayCalc', 'machOf', 'pnQuote',
        'PRICES', 'DXF_LAYERS', 'dxfForThickness', 'buildDxfByThickness', 'pnDxfForThickness',
        'ncPegasus', 'tpPartMoves', 'tpSegsForSheet', 'tpDatumOff', 'tpXform', 'tpDefaults',
        'ringPts', 'ringWalker', 'emitLapFrom', 'emitRampThenLap',
        'mrInsert', 'autoPack', 'packMulti', 'offcut', 'pnLayoutRoom', 'pnNestRoom'];
      const added = git('diff --cached -U0 -- index.html').split('\n')
        .filter(l => l.startsWith('+') && !l.startsWith('+++')).join('\n');
      const hit = GUARDED.filter(g => added.includes(g));
      const goldensStaged = staged.some(f => f.startsWith('tests/golden/'));
      if (hit.length && !goldensStaged) {
        console.error('\nWARNING (not blocking): staged index.html touches guarded functions ['
          + hit.join(', ') + '] but no tests/golden/* files are staged.\n'
          + 'If machine/price output changed intentionally: regenerate the goldens in THIS commit '
          + '(tests/golden/README.md). If unchanged: prove it with a golden diff, then commit.\n');
      }
    }
  } catch (e) { failures.push('pre-commit git checks failed to run: ' + (e && e.message || e)); }
}

if (failures.length) {
  console.error('KABACAL CHECK FAILED:\n - ' + failures.join('\n - '));
  process.exit(2);
}
console.log('kabacal check ok');
