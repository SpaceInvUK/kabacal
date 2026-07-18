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
      const api = new Function(pnSrc + ';return {pnLayoutRoom:pnLayoutRoom,PN_CAP:PN_CAP,PN_CROSS:PN_CROSS,pnPlanCompile:pnPlanCompile,pnPlanLen:pnPlanLen,PN_WALL_T:PN_WALL_T,PN_PANEL_T:PN_PANEL_T,pnRoomDefs:pnRoomDefs};')();
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
        // 2026-07-18 (Ednei): zone width follows the vertical sheet tiers — up to 2000 allowed; >1206 needs a
        // 10x5, >1520 a special-order sheet (flagged). Height still clamps to 3000 (10x4 length).
        const wide = api.pnLayoutRoom(room([wall({ w: 5000, vZones: [{ id: 'z2', x: 100, w: 1600, h: 3500 }] })])).pieces.find(p => p.isZone);
        must(Math.abs(wide.w - 1600) < 0.6 && wide.h <= 3000.6, `zone 1600 wide must be HONOURED (special tier), height clamps to 3000 (got ${wide.w}×${wide.h})`);
        must(wide.sheet === 'special', `zone 1600 wide → sheet "special" (got ${wide.sheet})`);
        const z105 = api.pnLayoutRoom(room([wall({ w: 5000, vZones: [{ id: 'z3', x: 100, w: 1400, h: 3000 }] })])).pieces.find(p => p.isZone);
        must(z105 && z105.sheet === '10x5', `zone 1400 wide → sheet 10x5 (got ${z105 && z105.sheet})`);
        const zBig = api.pnLayoutRoom(room([wall({ w: 5000, vZones: [{ id: 'z4', x: 100, w: 2600, h: 3000 }] })])).pieces.find(p => p.isZone);
        must(zBig && zBig.w <= 2000.6, `zone width must hard-cap at 2000 (got ${zBig && zBig.w})`);
        // overlapping zones auto-resolve (2026-07-18 "C inside D" fix): the later zone shifts right + warning
        const ovl = api.pnLayoutRoom(room([wall({ w: 5000, vZones: [{ id: 'za', x: 1000, w: 1000, h: 3000 }, { id: 'zb', x: 1500, w: 1000, h: 3000 }] })]));
        const za = ovl.pieces.find(p => p.zid === 'za'), zb = ovl.pieces.find(p => p.zid === 'zb');
        must(!!za && !!zb && zb.x0 >= za.x1 - 0.6, `overlapping zones must not overlap after layout (za ends ${za && Math.round(za.x1)}, zb starts ${zb && Math.round(zb.x0)})`);
        must(ovl.warns.some(w => /overlapped|auto-adjusted/.test(w)), 'overlapping zones must raise a warning');
        const noZoneGeom = JSON.stringify(plain.map(p => [Math.round(p.x0), Math.round(p.x1)]));
        const stillPlain = JSON.stringify(api.pnLayoutRoom(room([wall({ w: 5000, vZones: [] })])).pieces.map(p => [Math.round(p.x0), Math.round(p.x1)]));
        must(noZoneGeom === stillPlain, 'empty vZones array must equal no-zone geometry (byte-identical safety)');
        // door-adjacent vertical zone (2026-07-10 fix, "James Test SNC" / Ensuite 3 / Wall 2): a vertical panel
        // butting a door must take the DOOR ALLOWANCE on that side (like a horizontal span after a door), not the
        // 40mm mid-wall joint — otherwise its shakers run into the door's clearance area.
        const dz = api.pnLayoutRoom(room([wall({ w: 2600, openings: [{ id: 'od', type: 'door', name: 'Door', w: 820, h: 2100, x: 0, from: 'L', bottom: 0, topPanel: 'yes' }], vZones: [{ id: 'zd', x: 820, w: 900, h: 1300, cols: 1, rows: 1 }] })]));
        const zoneD = dz.pieces.find(p => p.isZone);
        must(!!zoneD && Math.abs(zoneD.x0 - 820) < 0.6, 'door-adjacent zone must start at the door edge (820)');
        must(zoneD.sides.l.rule === 'door' && Math.abs(zoneD.sides.l.mm - 175) < 0.6, 'zone side facing a door must use the door allowance (175), not the 40mm joint');
        must(Math.abs(zoneD.sides.r.mm - 40) < 0.6, 'the zone side NOT facing the door stays a 40mm joint');
        const dcell = [...zoneD.cells].sort((a, b) => a.x - b.x)[0];
        must(!!dcell && Math.abs((zoneD.x0 + dcell.x) - (820 + 175)) < 1, 'zone shaker must start a full door allowance clear of the door (995), not 40mm in');
        must(Math.abs(zoneD.w - 900) < 0.6, 'door-adjacent zone keeps its physical width (only the internal cavity moves) — no too-long/short panel');
        const midZone = api.pnLayoutRoom(room([wall({ w: 5000, vZones: [{ id: 'zm', x: 2000, w: 1000, h: 3000 }] })])).pieces.find(p => p.isZone);
        must(Math.abs(midZone.sides.l.mm - 40) < 0.6 && Math.abs(midZone.sides.r.mm - 40) < 0.6, 'mid-wall zone (no adjacent door) keeps 40/40 joints — no regression');
        // ---- per-panel side GAP / OVERLAP (2026-07-11): physical, thickness-driven, opt-in ----
        { // gap pulls the edge back by the ACTUAL panel thickness (material 18mm here, NOT 22)
          const Lg = api.pnLayoutRoom(room([wall({ w: 3000, panelOv: { w0p1: { sideR: 'gap' } } })]));
          const pg = Lg.pieces.find(p => p.pid === 'w0p1');
          must(!!pg && Math.abs(pg.x1 - (3000 - 18)) < 0.6 && Math.abs(pg.w - 2982) < 0.6, 'panel-side GAP must shorten the panel by the material thickness (18 → x1 2982), got ' + (pg && pg.x1));
          must(Math.abs(pg.sides.r.mm - 80) < 0.6, 'a gap side keeps a NORMAL frame margin (80)');
          const Lo = api.pnLayoutRoom(room([wall({ w: 3000, panelOv: { w0p1: { sideL: 'overlap' } } })]));
          const po = Lo.pieces.find(p => p.pid === 'w0p1');
          must(!!po && Math.abs(po.x0 - (-18)) < 0.6 && Math.abs(po.w - 3018) < 0.6, 'panel-side OVERLAP must extend the panel by the material thickness (18 → w 3018), got ' + (po && po.w));
          const L22 = api.pnLayoutRoom(room([wall({ w: 3000, panelOv: { w0p1: { sideR: 'gap' } } })], { mat: 'MDF 22mm' }));
          const p22 = L22.pieces.find(p => p.pid === 'w0p1');
          must(!!p22 && Math.abs(p22.w - (3000 - 22)) < 0.6, 'gap/overlap must use the ACTUAL thickness (22mm material → −22), got ' + (p22 && p22.w));
          must(!Lg.pieces.some(p => p.conflict), 'a lone gap/overlap panel raises NO conflict');
          const Ln = api.pnLayoutRoom(room([wall({ w: 3000 })]));
          must(!Ln.pieces.some(p => p.ovPhys || p.conflict), 'no override → no phys adjustment, no conflict (byte-identical safety)');
        }
        { // overlap CONFLICT: two adjacent pieces on one wall — extending one into the other flags BOTH + warns
          const base = api.pnLayoutRoom(room([wall({ w: 5000 })]));
          must(base.pieces.filter(p => p.wi === 0).length >= 2, 'a 5000 wall splits into 2+ pieces (test precondition)');
          const Lc = api.pnLayoutRoom(room([wall({ w: 5000, panelOv: { w0p1: { sideR: 'overlap' } } })]));
          const c1 = Lc.pieces.find(p => p.pid === 'w0p1'), c2 = Lc.pieces.find(p => p.pid === 'w0p2');
          must(!!c1 && !!c2 && c1.conflict === true && c2.conflict === true, 'overlap into the neighbouring panel must flag BOTH pieces as conflict');
          must(Lc.warns.some(w => /overlap conflict/.test(w)), 'overlap conflict must raise a warning (allowed, never blocked)');
        }
        { // per-panel SKIRTING: wall.panelSkirt[pid] moves ONLY that panel's bottom margin (panel > wall > room)
          const Ls = api.pnLayoutRoom(room([wall({ w: 5000, panelSkirt: { w0p1: { mode: 'custom', on: true, h: 400 } } })]));
          const s1 = Ls.pieces.find(p => p.pid === 'w0p1'), s2 = Ls.pieces.find(p => p.pid === 'w0p2');
          must(!!s1 && Math.abs(s1.sides.b - (400 + 80)) < 0.6, 'panel skirting 400 → that panel bottom margin 480, got ' + (s1 && s1.sides.b));
          must(!!s1 && s1.cells.length && Math.abs(Math.min(...s1.cells.map(c => c.y)) - 480) < 0.6, 'panel-skirt panel cells must start at the new bottom');
          must(!!s2 && Math.abs(s2.sides.b - (225 + 80)) < 0.6, 'the OTHER panel keeps the room skirting (225+80)');
        }
        // window (2026-07-08 fix): band notched DOWN TO THE FLOOR at the window column so it never overlaps the
        // separate lower panel (was: only the window rect, so the band covered 0..bottom = the overlap bug).
        const wr = api.pnLayoutRoom(room([wall({ w: 3000, openings: [{ id: 'ow', type: 'window', name: 'W', w: 1200, h: 1100, x: 1200, from: 'L', bottom: 900, topPanel: 'yes' }] })]));
        const lower = wr.pieces.find(p => p.isLower), bandp = wr.pieces.find(p => p.wi === 0 && !p.isLower && !p.isCap);
        must(!!lower && !!bandp, 'window must create a lower panel + a band');
        const wnotch = (bandp.notches || []).find(n => n.w > 1);
        must(!!wnotch && wnotch.y <= 0.5, 'window notch must reach the floor (y≈0) so the band does not overlap the lower panel');
        must(!!lower && (lower.y1 <= wnotch.y + wnotch.h + 0.5), 'lower panel must sit within the band notch (no double coverage)');
      }
      { // 2D room builder: compilePlan (2026-07-08) — plan is the source, walls derived; safe + preserving
        must(typeof api.pnPlanCompile === 'function', 'pnPlanCompile must be exported from PN_ENGINE');
        must(api.PN_WALL_T === 100 && api.PN_PANEL_T === 22, 'plan defaults must be wall 150 / panel 22');
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
        // corner inference (Phase 2): the shorter middle wall butts both ends → shortened by 2×panel (default 22): 3000-44
        must(w3.length === 3 && w3[0].w === 4000 && w3[1].w === 2956 && w3[2].w === 4000, `three connected walls → 4000/2956/4000 (middle butts both ends, got ${w3.map(w=>w.w)})`);
        // preserve prior wall settings by id across recompile; plan drives size
        const prevRoom = { mat: 'MDF 18mm', walls: [{ id: 'pe_e1', w: 999, h: 999, dir: 'v', shakerCount: 5, skirt: { mode: 'custom', on: false } }], plan: p1 };
        const w1b = api.pnPlanCompile(prevRoom)[0];
        must(w1b.w === 3000 && w1b.dir === 'v' && w1b.shakerCount === 5 && w1b.skirt && w1b.skirt.on === false, 'recompile preserves dir/shaker/skirt by id, size from plan');
        // plan opening compiles onto the edge's wall
        const pOp = { nodes: p1.nodes, edges: p1.edges, openings: [{ id: 'o1', edgeId: 'e1', type: 'door', offset: 800, width: 900, height: 2100 }] };
        const wOp = api.pnPlanCompile({ mat: 'MDF 18mm', walls: [], plan: pOp })[0];
        must(wOp.openings.length === 1 && wOp.openings[0].type === 'door' && wOp.openings[0].w === 900 && wOp.openings[0].x === 800, 'plan opening compiles into wall.openings');
        // ---- wall-END overlap conflict flag (2026-07-11): overlap vs a THROUGH neighbour = conflict; vs BUTT = clean ----
        {
          const mkL = (endB, othEnd) => api.pnPlanCompile({ frame: 80, walls: [], plan: { nodes: [{ id: 'n1', x: 0, y: 0 }, { id: 'n2', x: 1000, y: 0 }, { id: 'n3', x: 1000, y: 2000 }],
            edges: [{ id: 'e1', a: 'n1', b: 'n2', wallThickness: 100, height: 3200, endB: endB }, { id: 'e2', a: 'n2', b: 'n3', wallThickness: 100, height: 3200, endA: othEnd }],
            openings: [], objects: [], panelLayer: { thickness: 22, side: 'front' } } });
          const ovT = mkL('overlap', undefined);
          must(ovT[0].cornerInfo.r.cond === 'overlap' && ovT[0].cornerInfo.r.conflict === true, 'overlap end vs a THROUGH neighbour must flag cornerInfo conflict');
          must(Math.abs(ovT[0].w - 1022) < 0.6, 'overlap end extends the panel by pt (1000 → 1022)');
          const ovB = mkL('overlap', 'butt');
          must(ovB[0].cornerInfo.r.cond === 'overlap' && ovB[0].cornerInfo.r.conflict === false, 'overlap end vs a BUTTING neighbour is clean (no conflict)');
          const ovN = mkL(undefined, undefined);
          must(!ovN[0].cornerInfo.r.conflict && !ovN[0].cornerInfo.l.conflict, 'no overlap → conflict flag stays false');
        }
      }
      { // CONFIRMED corner rule (2026-07-10): THROUGH side = frame+pt allowance; BUTT side = normal frame + pt gap.
        // Wall stays full measured length; only the BUTT panel is physically shortened by pt.
        const U = pt => ({ mat: 'MDF 18mm', frame: 80, walls: [], plan: { panelLayer: { thickness: pt, side: 'front' },
          nodes: [{ id: 'A', x: 0, y: 3000 }, { id: 'B', x: 0, y: 0 }, { id: 'C', x: 2000, y: 0 }, { id: 'D', x: 2000, y: 3000 }],
          edges: [{ id: 'L', a: 'A', b: 'B' }, { id: 'M', a: 'B', b: 'C' }, { id: 'R', a: 'C', b: 'D' }] } });   // U: sides 3000, base 2000
        const u22 = api.pnPlanCompile(U(22)), base22 = u22.find(w => w.id === 'pe_M');
        must(base22.w === 1956, `U base with 22mm panels must be 2000-22-22=1956 (got ${base22.w})`);
        must(base22.sideL === 'normal' && base22.sideR === 'normal', 'U base BUTTS both ends → NORMAL frame (butt keeps normal frame)');
        must(base22.cornerInfo.l.shorten === 22 && base22.cornerInfo.l.gap === 22 && base22.cornerInfo.l.allowance === 80,
          `U base butt end: shorten 22 + gap 22 + normal frame 80 (got shorten ${base22.cornerInfo.l.shorten}, gap ${base22.cornerInfo.l.gap}, allowance ${base22.cornerInfo.l.allowance})`);
        const sideL = u22.find(w => w.id === 'pe_L');   // side wall passes THROUGH at B (the base butts into it)
        must(sideL.w === 3000 && sideL.sideL === 'normal' && sideL.sideR === 'corner', 'U side wall: full length, free end normal, THROUGH end = corner (frame+pt)');
        must(sideL.cornerInfo.r.cond === 'through' && sideL.cornerInfo.r.allowance === 102 && sideL.cornerInfo.r.gap === 0,
          `U side THROUGH end allowance 80+22=102, no gap (got ${sideL.cornerInfo.r.allowance})`);
        const u18 = api.pnPlanCompile(U(18)), side18 = u18.find(w => w.id === 'pe_L');
        must(side18.cornerInfo.r.allowance === 98, 'U side THROUGH allowance with 18mm must be 80+18=98 (thickness-driven, not 102)');
        // L: shorter wall butts once
        const Lp = pt => ({ mat: 'MDF 18mm', frame: 80, walls: [], plan: { panelLayer: { thickness: pt },
          nodes: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 4000, y: 0 }, { id: 'c', x: 4000, y: 3000 }], edges: [{ id: 'e1', a: 'a', b: 'b' }, { id: 'e2', a: 'b', b: 'c' }] } });
        const l22 = api.pnPlanCompile(Lp(22));
        must(l22.find(w => w.id === 'pe_e1').w === 4000 && l22.find(w => w.id === 'pe_e1').sideR === 'corner', 'L through wall: full length + through end corner');
        must(l22.find(w => w.id === 'pe_e2').w === 2978 && l22.find(w => w.id === 'pe_e2').cornerInfo.l.shorten === 22 && l22.find(w => w.id === 'pe_e2').sideL === 'normal', 'L butting wall 3000-22=2978, normal frame');
        { // user's worked example (item 2): Wall1 2000, Wall2 1000 (shorter → butts BOTH ends), Wall3 2000
          const ex = pt => ({ mat: 'MDF 18mm', frame: 80, walls: [], plan: { panelLayer: { thickness: pt },
            nodes: [{ id: 'n1', x: 2000, y: 0 }, { id: 'n2', x: 0, y: 0 }, { id: 'n3', x: 0, y: 1000 }, { id: 'n4', x: 2000, y: 1000 }],
            edges: [{ id: 'w1', a: 'n1', b: 'n2' }, { id: 'w2', a: 'n2', b: 'n3' }, { id: 'w3', a: 'n3', b: 'n4' }] } });
          const c22 = api.pnPlanCompile(ex(22)), w2 = c22.find(w => w.id === 'pe_w2');
          must(w2.measured === 1000 && w2.w === 956, `example Wall 2: measured 1000, panel 1000-22-22=956 (got measured ${w2.measured}, w ${w2.w})`);
          must(w2.sideL === 'normal' && w2.sideR === 'normal', 'example Wall 2 keeps the NORMAL 80mm frame both ends');
          must(w2.cornerInfo.l.gap === 22 && w2.cornerInfo.r.gap === 22, 'example Wall 2 has a 22mm gap at each end');
          const w1 = c22.find(w => w.id === 'pe_w1');   // through wall gets frame+pt on its through end
          must(w1.measured === 2000 && w1.w === 2000 && (w1.sideR === 'corner' || w1.sideL === 'corner'), 'example through wall stays 2000 + has a frame+pt (corner) end');
          // corner gap priority (item 5): 'longgap' → the LONGER wall butts/takes the gap instead of the shorter.
          const exL = ex(22); exL.plan.cornerMode = 'longgap'; const cL = api.pnPlanCompile(exL);
          const lw2 = cL.find(w => w.id === 'pe_w2'), lw1 = cL.find(w => w.id === 'pe_w1');
          must(lw2.w === 1000 && lw2.cornerInfo.l.gap === 0 && lw2.cornerInfo.r.gap === 0, `longgap: short Wall 2 now passes THROUGH (no gap, w ${lw2.w})`);
          must(lw1.measured === 2000 && lw1.w === 1978 && (lw1.cornerInfo.l.gap === 22 || lw1.cornerInfo.r.gap === 22), `longgap: long Wall 1 now BUTTS (2000-22=1978, got ${lw1.w})`);
        }
        { // OVERLAP (manual per-end): panel EXTENDS past the wall end by the actual panel thickness; measured stays.
          const ovr = (pt, a, b) => { const r = { mat: 'MDF 18mm', frame: 80, walls: [], plan: { panelLayer: { thickness: pt },
            nodes: [{ id: 'n1', x: 0, y: 0 }, { id: 'n2', x: 1000, y: 0 }], edges: [{ id: 'e1', a: 'n1', b: 'n2' }] } };
            if (a) r.plan.edges[0].endA = a; if (b) r.plan.edges[0].endB = b; return api.pnPlanCompile(r)[0]; };
          const one = ovr(22, 'overlap', null), both = ovr(22, 'overlap', 'overlap'), both18 = ovr(18, 'overlap', 'overlap');
          must(one.measured === 1000 && one.w === 1022 && one.cornerInfo.l.extend === 22, `overlap one end: measured 1000, panel 1000+22=1022 (got ${one.w})`);
          must(both.measured === 1000 && both.w === 1044, `overlap both ends (22): panel 1000+22+22=1044 (got ${both.w})`);
          must(both18.measured === 1000 && both18.w === 1036 && both18.cornerInfo.l.extend === 18, `overlap both ends (18): panel 1000+18+18=1036, extend 18 (got ${both18.w})`);
        }
        // corner allowance in the actual engine uses panel thickness for a plan room; compile→walls then lay out
        const uc = U(18); uc.walls = api.pnPlanCompile(uc);
        const dPlan = api.pnLayoutRoom(uc);   // must run without throwing and produce pieces from the compiled walls
        must(dPlan.pieces.length >= 1, 'plan room with corners still lays out through the engine');
        // the shortened base width must flow all the way to the physical pieces (compile → engine)
        const baseW = dPlan.pieces.filter(p => p.wi === 1 && !p.isCap).reduce((s, p) => s + (p.x1 - p.x0), 0);
        must(Math.abs(baseW - 1964) < 1.5, `U base pieces must span the shortened 1964mm through the engine (got ${Math.round(baseW)})`);
      }
      { // cross-corner shaker MATCH (item 5, opt-in): OFF = natural per-wall widths; ON pins each wall's corner
        // shakers to the shared target so an L corner's two panels meet with equal-width shakers.
        const Lroom = match => { const r = { mat: 'MDF 18mm', frame: 80, target: 350, cornerMatch: match, walls: [], plan: {
          nodes: [{ id: 'n1', x: 3200, y: 0 }, { id: 'n2', x: 0, y: 0 }, { id: 'n3', x: 0, y: 1500 }], edges: [{ id: 'w1', a: 'n1', b: 'n2' }, { id: 'w2', a: 'n2', b: 'n3' }] } };
          r.walls = api.pnPlanCompile(r); return api.pnLayoutRoom(r); };
        const cw = (lay, wi, side) => { const cs = []; lay.pieces.filter(p => p.wi === wi && !p.isCap && !p.isLower).forEach(p => (p.cells || []).forEach(c => cs.push({ x: p.x0 + c.x, w: Math.round(c.w) }))); cs.sort((a, b) => a.x - b.x); return side === 'first' ? cs[0].w : cs[cs.length - 1].w; };
        const off = Lroom(false);
        must(cw(off, 0, 'first') === 363 && cw(off, 1, 'first') === 386, `cornerMatch OFF: natural widths 363 / 386 (got ${cw(off, 0, 'first')} / ${cw(off, 1, 'first')})`);
        const on = Lroom(true);
        must(cw(on, 0, 'first') === 350 && cw(on, 0, 'last') === 350 && cw(on, 1, 'first') === 350 && cw(on, 1, 'last') === 350, 'cornerMatch ON: every corner shaker == target 350 (matched across the L)');
      }
      { // window overlap fix (item 6): sill AT/above the band → NO lower panel (no "panels on top of panels");
        // sill INSIDE the band → one lower panel + the band notched to the floor, with no solid overlap.
        const wroom = bottom => api.pnLayoutRoom(room([wall({ w: 3000, openings: [{ id: 'ow', type: 'window', name: 'W', w: 1200, h: 1100, x: 900, from: 'L', bottom, topPanel: 'yes' }] })]));
        const bandH = api.pnRoomDefs(room([wall({})])).hPanelH;
        must(wroom(bandH).pieces.filter(p => p.isLower).length === 0, 'window sill AT the band top makes NO lower panel (was the overlap bug)');
        must(wroom(bandH + 500).pieces.filter(p => p.isLower).length === 0, 'window ABOVE the band makes NO lower panel');
        const within = wroom(400);
        must(within.pieces.filter(p => p.isLower).length === 1, 'window sill INSIDE the band makes exactly one lower panel');
        const solidOverlap = ps => { const cov = (p, ix0, ix1, iy0, iy1) => (p.notches || []).some(n => (p.x0 + n.x) <= ix0 + 1 && (p.x0 + n.x + n.w) >= ix1 - 1 && (p.y0 + n.y) <= iy0 + 1 && (p.y0 + n.y + n.h) >= iy1 - 1);
          for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) { const a = ps[i], b = ps[j], ix0 = Math.max(a.x0, b.x0), ix1 = Math.min(a.x1, b.x1), iy0 = Math.max(a.y0, b.y0), iy1 = Math.min(a.y1, b.y1); if (ix1 - ix0 > 1 && iy1 - iy0 > 1 && !cov(a, ix0, ix1, iy0, iy1) && !cov(b, ix0, ix1, iy0, iy1)) return true; } return false; };
        must(!solidOverlap(within.pieces) && !solidOverlap(wroom(bandH).pieces) && !solidOverlap(wroom(0).pieces), 'no solid panel overlap for window at floor / inside band / at band top');
      }
      { // Object panels (2026-07-10): an ELEVATED object (bottom > 2*frame) gets a panel BELOW it + a cap ABOVE;
        // on the floor → no below panel; a too-small gap under it → no useless strip.
        const oroom = (bottom, h) => api.pnLayoutRoom(room([wall({ w: 4000, openings: [{ id: 'ob', type: 'object', name: 'TV', w: 1000, h, x: 1500, from: 'L', bottom, topPanel: 'yes' }] })]));
        const f = api.pnRoomDefs(room([wall({})])).frame;
        const el = oroom(400, 300);
        must(el.pieces.filter(p => p.isLower).length === 1, 'elevated object (bottom>2*frame) makes ONE panel below it');
        must(el.pieces.filter(p => p.isCap).length >= 1, 'object with its top inside the band gets a closing cap above');
        must(oroom(0, 600).pieces.filter(p => p.isLower).length === 0, 'object on the floor makes NO panel below');
        must(oroom(Math.round(f), 300).pieces.filter(p => p.isLower).length === 0, 'object with a gap < 2*frame below makes no useless strip');
      }
      { // Panel ON/OFF per wall (edge.noPanel) — the wall stays, but produces NO pieces (excluded from quote/DXF/nesting)
        const twoWall = () => ({ mat: 'MDF 18mm', frame: 80, walls: [], plan: {
          nodes: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 4000, y: 0 }, { id: 'c', x: 4000, y: 3000 }],
          edges: [{ id: 'e1', a: 'a', b: 'b' }, { id: 'e2', a: 'b', b: 'c' }] } });
        const rOn = twoWall(); rOn.walls = api.pnPlanCompile(rOn);
        const pcOn = api.pnLayoutRoom(rOn).pieces.filter(p => p.wi === 0).length;
        must(pcOn >= 1, 'wall 0 produces pieces when its panel is ON');
        const rOff = twoWall(); rOff.plan.edges[0].noPanel = true; rOff.walls = api.pnPlanCompile(rOff);
        must(rOff.walls[0].noPanel === true, 'edge.noPanel compiles to wall.noPanel');
        const layOff = api.pnLayoutRoom(rOff);
        must(layOff.pieces.filter(p => p.wi === 0).length === 0, 'a noPanel wall produces ZERO pieces');
        must(layOff.pieces.filter(p => p.wi === 1).length >= 1, 'the OTHER wall is unaffected by a neighbour noPanel');
      }
      { // Corner winding (item 4): AUTO (default) = longer-through, byte-identical; WINDING = opt-in draw-direction rule
        const rect = () => ({ mat: 'MDF 18mm', frame: 80, walls: [], plan: {
          nodes: [{ id: 'n1', x: 0, y: 0 }, { id: 'n2', x: 4200, y: 0 }, { id: 'n3', x: 4200, y: 3000 }, { id: 'n4', x: 0, y: 3000 }],
          edges: [{ id: 'e1', a: 'n1', b: 'n2' }, { id: 'e2', a: 'n2', b: 'n3' }, { id: 'e3', a: 'n3', b: 'n4' }, { id: 'e4', a: 'n4', b: 'n1' }] } });
        const cc = ws => ws.map(w => w.cornerInfo.l.cond[0] + w.cornerInfo.r.cond[0]).join(',');
        const rAuto = rect(); const wAuto = api.pnPlanCompile(rAuto);
        must(cc(wAuto) === 'tt,bb,tt,bb', `AUTO winding default = longer-through (got ${cc(wAuto)})`);   // horizontals through, verticals butt
        must(!!wAuto[0].cornerInfo.winding, 'winding is detected and recorded on cornerInfo');
        const rW = rect(); rW.plan.cornerMode = 'winding'; const wW = api.pnPlanCompile(rW);
        wW.forEach(w => must(w.cornerInfo.l.cond !== w.cornerInfo.r.cond, 'winding: each wall is one-through + one-butt (consistent lapping)'));
        must(cc(wW) !== cc(wAuto), 'winding mode differs from auto (capability is wired, not hard-coded away)');
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
      const SH = { '8x4': { w: 2440, h: 1220 }, '10x4': { w: 3050, h: 1220 }, '10x5': { w: 3050, h: 1525 }, jumbo: { w: 2800, h: 2070, uh: 2050 } };
      const api = new Function('sheetMeta', 'grainActive', 'rigidOrient', 'isHost', 'matSizeDef', 'nestSize', 'SHEETS', 'sheetDef', 'nestMargin', 'nestGap',
        nestSrc + ';return {mrInsert, mrNewBin, mrPackBins, autoPack, packInto, fitSheetSize};')(
        () => ({ sz: '8x4', S: { w: 2440, h: 1220 }, g: 7, margin: 7 }),   // stub: default 8x4, 7mm margin/gap
        () => false, p => ({ w: p.w, h: p.h }), () => false,
        {}, '8x4', SH, sz => SH[sz] || SH['8x4'], 7, 7);                    // matSizeDef / nestSize / SHEETS / sheetDef / nestMargin / nestGap
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
      // an oversize part (longer than the default 8x4 sheet) must AUTO-UPSIZE to a fitting sheet, never overflow
      const big = api.autoPack('MDF 18mm', [{ key: 'big', w: 295, h: 2850 }]);   // 2850 > 8x4 length 2440 -> 10x4 (3050)
      must(big.length === 1 && big[0].sz === '10x4', `nest: oversize part must upsize to 10x4 (got ${big.map(b => b.sz).join(',')})`);
      must(big[0].parts.length === 1, 'nest: oversize part must not be dropped');
      const bp = big[0].parts[0], bS = big[0].S;
      must(bp.x >= 6.99 && bp.y >= 6.99 && bp.x + bp.w <= bS.w - 6.99 && bp.y + bp.h <= (bS.uh || bS.h) - 6.99, 'nest: upsized part must sit inside its sheet');
      must(api.fitSheetSize({ w: 600, h: 400 }, '8x4') === '8x4', 'nest: a part that fits the default keeps the default size');
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

// 8. E2E behavioural sandbox (audit rec #10): execute the WHOLE app script in node with DOM/storage
//    stubs and assert the job-lifecycle + pricing + NC behaviours that the grep tripwires can't see.
//    Skipped in --hook mode (runs on every full check / CI).
if (html && !process.argv.includes('--hook')) {
  try {
    const src = (html.match(/<script[^>]*>([\s\S]*?)<\/script>/i) || [])[1] || '';
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
    const alerts = []; const win = { addEventListener() {}, removeEventListener() {}, open: () => null, matchMedia: () => ({ matches: false, addEventListener() {} }), location: { href: '', search: '', origin: 'http://x', reload() {} } };
    win.window = win;
    // browsers expose every id="..." as an implicit global (the app leans on this, e.g. sItems/qaW) —
    // recreate that in node by pre-seeding globalThis with fake elements for every id in the markup
    new Set([...html.matchAll(/id="([A-Za-z_$][\w$]*)"/g)].map(m => m[1])).forEach(id => { if (!(id in globalThis)) globalThis[id] = mkEl(); });
    const api = new Function('window', 'document', 'localStorage', 'sessionStorage', 'alert', 'confirm', 'prompt', 'navigator', 'location', 'fetch', 'setTimeout', 'clearTimeout',
      src + `;return {
        get items(){return items}, get camPaths(){return camPaths}, get project(){return project},
        get services(){return services}, get vatOn(){return vatOn}, get panelRooms(){return panelRooms},
        get toolDb(){return toolDb}, get nestNote(){return nestNote}, get camJob(){return camJob}, get selSet(){return selSet},
        loadFastCnc, calcQuote, mkItem, addTakeoffItems, parseTakeoffText, parseTakeoffLine, clearSel, render,
        priceForSheet, ncPegasus, tpSegsForSheet, tpSheets, tpDefaults, ensureOrderNumber, toolById, tplAutoSyncItem,
        doorCavities, buildFastCnc
      }`)(win, doc, ls, ss, m => alerts.push(String(m)), () => true, () => null, { userAgent: 'node' }, win.location, () => Promise.reject(new Error('offline')), () => 0, () => {});

    // (a) boot: empty job, LAZY order number (no sequence consumed at page-open)
    must(api.items.length === 0, 'e2e boot: items must start empty');
    must(api.project.number === '', 'e2e boot: order number must be empty (lazy)');
    must(ls.getItem('kab_seq') === null, 'e2e boot: no sequence number consumed at open');

    // (b) pricing invariants at runtime: the standard basket = £300 sub / £360 inc VAT, 12 parts
    api.addTakeoffItems(api.parseTakeoffText('600 x 400 x 6\n715 x 495 x 2\n300 x 300 x 4')); api.render();
    const qa = api.calcQuote();
    must(qa.sub === 300 && qa.vat === 60 && qa.total === 360 && qa.partN === 12, `e2e pricing: standard basket must be 300/60/360 with 12 parts (got ${qa.sub}/${qa.vat}/${qa.total}/${qa.partN})`);
    must(api.priceForSheet('MDF 18mm', '10x4') === 75, 'e2e pricing: MDF 18mm on 10x4 must be exactly 75');

    // (c) GOLDEN NC at runtime — regenerate the standard job and byte-compare with tests/golden
    api.camPaths.length = 0;
    api.camPaths.push({ id: 'tp_golden', on: true, kind: 'profile', name: 'Profile 1', toolId: 't1', params: api.tpDefaults() });
    Object.assign(api.camJob, { zZero: 'bed', datum: 'll', rapidGap: 20, approach: 5, orient: 'portrait' });
    const ncLL = api.ncPegasus(api.tpSegsForSheet(api.tpSheets()[0]));
    const goldLL = readFileSync(join(root, 'tests', 'golden', 'GOLDEN_S1_18mm_datum-ll.nc'), 'utf8');
    must(ncLL === goldLL, 'e2e golden: regenerated datum-ll NC must be byte-identical to tests/golden');

    // (d) transactional load: a rejected file must not touch the current job
    api.camPaths.length = 0;
    api.items.length = 0; api.clearSel();
    api.items.push(api.mkItem('flat', 600, 400, 2, 'MDF 18mm', '8x4', { t: 0, r: 0, b: 0, l: 0 }, null, 'KEEP', { on: false }, { offsetName: 'None' })); api.render();
    api.camPaths.push({ id: 'tp_keep', on: true, kind: 'profile', name: 'Keep', toolId: 't1', params: api.tpDefaults() });
    api.services.design = 3;
    api.loadFastCnc({ blocks: [{ autoGenerated: false, parts: [] }] });
    must(api.items.length === 1 && api.items[0].text === 'KEEP' && api.camPaths.length === 1 && api.services.design === 3,
      'e2e transactional: a rejected .fastcnc must leave items/camPaths/services untouched');

    // (e) full reset on load + Tool DB policy (library wins, unknown tools added, notice set)
    const t1feed = api.toolById('t1').feed;
    api.vatOn === true; api.services.design = 3; api.panelRooms.push({ name: 'X', walls: [] });
    api.loadFastCnc({ blocks: [{ material: 'MDF', thickness: '18mm', size: '8x4', frameSize: 50, parts: [{ width: '700', height: '500', quantity: '1', doorType: 'no' }] }],
      kabacalQuote: { camTools: [Object.assign({}, api.toolById('t1'), { feed: 1234 }), { id: 'tz_e2e', name: 'File tool', num: 9, dia: 10, feed: 5000, plunge: 2000, rpm: 12000, passDepth: 5 }] } });
    must(api.services.design === 0 && api.vatOn === true && api.panelRooms.length === 0, 'e2e reset: services/VAT/panels must reset when a file is loaded');
    must(api.toolById('t1').feed === t1feed, 'e2e tool policy: the machine library must win an id conflict');
    must(!!api.toolById('tz_e2e'), 'e2e tool policy: unknown file tools must be ADDED');
    must(/DIFFERENT settings/.test(api.nestNote || ''), 'e2e tool policy: the conflict notice must be shown');
    must(api.project.number === '', 'e2e lazy number: loading a file without a number must not generate one');
    api.ensureOrderNumber();
    must(api.project.number !== '' && ls.getItem('kab_seq') === '1', 'e2e lazy number: first save-path call generates it and consumes seq 1');

    // (f) takeoff parser contract (incl. the documented ambiguous case)
    const p1 = api.parseTakeoffLine('600 x 400 x 6'); must(p1 && p1.quantity === 6 && p1.width === 600 && p1.height === 400, 'e2e takeoff: "600 x 400 x 6" = 600×400 qty 6');
    const p2 = api.parseTakeoffLine('3 x 600 x 400'); must(p2 && p2.quantity === 3 && p2.width === 600, 'e2e takeoff: "3 x 600 x 400" = qty 3');
    const p3 = api.parseTakeoffLine('100 x 600 x 400'); must(p3 && p3.width === 100 && p3.height === 600 && p3.quantity === 1, 'e2e takeoff: "100 x 600 x 400" parses W100 H600 qty1 (extra number flagged in the preview)');
    must(api.parseTakeoffLine('no dimensions here') === null, 'e2e takeoff: rubbish lines must parse to null');

    // (g) "Bottom part" contract (2026-07-15 fix): ABSOLUTE distance from the BOTTOM of the piece to the
    // top of the lower section, INCLUDING the bottom frame. 2000 tall · frame 50 · mid 50 · bottom part 400
    // ⇒ lower opening 350 spanning y1600..1950 (top-down), upper opening 1500 @ y50, rail + frames untouched.
    const bpDoor = api.mkItem('trad', 600, 2000, 1, 'MDF 18mm', '8x4', { t: 50, r: 50, b: 50, l: 50 }, null, 'BP', { on: false },
      { offsetName: 'Plain Shaker', panels: 2, midFrame: 50, panelSize: 400 });
    const bpCs = api.doorCavities(bpDoor);
    must(bpCs.length === 2, 'bottom part: 2 panels must yield 2 openings');
    const bpUp = bpCs[0], bpLo = bpCs[1];
    must(bpLo.h === 350, `bottom part: lower OPENING must be 350 (= 400 − 50 bottom frame), got ${bpLo.h}`);
    must(2000 - bpLo.y === 400, `bottom part: lower section incl. frame must end exactly 400 from the bottom of the piece, got ${2000 - bpLo.y}`);
    must(bpUp.h === 1500 && bpUp.y === 50, `bottom part: upper opening must absorb the rest (1500 @ y50), got ${bpUp.h} @ y${bpUp.y}`);
    must(bpLo.y - (bpUp.y + bpUp.h) === 50, 'bottom part: mid rail must stay exactly 50');
    must(2000 - (bpLo.y + bpLo.h) === 50, 'bottom part: bottom frame must stay exactly 50');
    const bpF = bpDoor.frame;
    must(bpF.t === 50 && bpF.r === 50 && bpF.b === 50 && bpF.l === 50, 'bottom part: frame values must not change');
    bpDoor.panelSize = 600;                                            // changing it moves ONLY the split point
    const bpCs2 = api.doorCavities(bpDoor);
    must(bpCs2[1].h === 550 && 2000 - bpCs2[1].y === 600 && bpCs2[0].h === 1300 && bpCs2[0].y === 50 && bpCs2[1].y - (bpCs2[0].y + bpCs2[0].h) === 50,
      'bottom part: changing 400→600 must resize ONLY lower (550) + upper (1300); rail and frames untouched');
    // persistence: .fastcnc keeps the production INNER value in panelSize + the absolute in kabBottomPart
    bpDoor.panelSize = 400;
    api.items.length = 0; api.clearSel(); api.items.push(bpDoor); api.render();
    const bpDocOut = api.buildFastCnc();
    const bpPart = bpDocOut.blocks.flatMap(b => b.parts || []).find(p => p.text === 'BP' || p.name === 'BP') || bpDocOut.blocks[0].parts[0];
    must(String(bpPart.panelSize) === '350' && +bpPart.kabBottomPart === 400,
      `bottom part save: .fastcnc must carry INNER 350 in panelSize + ABSOLUTE 400 in kabBottomPart, got ${bpPart.panelSize}/${bpPart.kabBottomPart}`);
    api.loadFastCnc(JSON.parse(JSON.stringify(bpDocOut)));
    must(+api.items[0].panelSize === 400, 'bottom part round-trip: reloading the file must restore the absolute 400');
    // legacy import (file saved before the fix / by the production app): inner 350 + frame 50 ⇒ absolute 400
    const bpLegacy = JSON.parse(JSON.stringify(bpDocOut));
    bpLegacy.blocks.forEach(b => (b.parts || []).forEach(p => { delete p.kabBottomPart; }));
    api.loadFastCnc(bpLegacy);
    must(+api.items[0].panelSize === 400, 'bottom part legacy import: inner 350 + bottom frame 50 must convert to absolute 400');
    const bpCs3 = api.doorCavities(api.items[0]);
    must(bpCs3.length === 2 && bpCs3[1].h === 350 && bpCs3[1].y === 1600 && bpCs3[0].h === 1500, 'bottom part legacy import: geometry must render identical to before the fix');

    // (h) ABSOLUTE midrails (2026-07-19): [{c,th}] measured from the bottom (right when landscape),
    // each rail with its own thickness; openings are the gaps. 2000 tall · frame 50 · rails c400/th50 +
    // c1000/th30 ⇒ openings top-down 935 / 560 / 325.
    const mrDoor = api.mkItem('trad', 600, 2000, 1, 'MDF 18mm', '8x4', { t: 50, r: 50, b: 50, l: 50 }, null, 'MR', { on: false },
      { offsetName: 'Plain Shaker', panels: 1, midrails: [{ c: 400, th: 50 }, { c: 1000, th: 30 }] });
    const mrCs = api.doorCavities(mrDoor);
    must(mrCs.length === 3, 'midrails: 2 rails must yield 3 openings');
    must(mrCs[0].y === 50 && mrCs[0].h === 935 && mrCs[1].y === 1015 && mrCs[1].h === 560 && mrCs[2].y === 1625 && mrCs[2].h === 325,
      `midrails: openings must be 935@50 / 560@1015 / 325@1625, got ${mrCs.map(c => c.h + '@' + c.y).join(' / ')}`);
    api.items.length = 0; api.clearSel(); api.items.push(mrDoor); api.render();
    const mrDoc = api.buildFastCnc();
    const mrPart = mrDoc.blocks.flatMap(b => b.parts || [])[0];
    must(Array.isArray(mrPart.kabMidrails) && mrPart.kabMidrails.length === 2 && mrPart.kabMidrails[0].c === 400 && +mrPart.panels === 3 && mrPart.panelSize === '',
      'midrails save: kabMidrails carries the list, panels falls back to rails+1 for old readers');
    api.loadFastCnc(JSON.parse(JSON.stringify(mrDoc)));
    const mrCs2 = api.doorCavities(api.items[0]);
    must(JSON.stringify(mrCs2) === JSON.stringify(mrCs), 'midrails round-trip: reloaded geometry must be identical');
  } catch (e) { failures.push('E2E sandbox failed to run: ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join(' | ')); }
}

if (failures.length) {
  console.error('KABACAL CHECK FAILED:\n - ' + failures.join('\n - '));
  process.exit(2);
}
console.log('kabacal check ok');
