# Golden files — CAM (.NC), DXF and quote regression net

These lock the machine-facing and price-facing output of the app for fixed jobs.
Any code change that alters them shows up as a diff — which must be **intended,
itemised, and shipped with regenerated goldens in the same commit** (see
AGENTS.md "Guarded zones" and docs/TESTING.md).

> **Status: regenerated 2026-07-07 for the PORTRAIT machine frame.** The user's
> datum test revealed the whole frame was rotated 90° vs the machine (Kabacal
> nests landscape; the Pegasus mounts the sheet portrait, X across 1220 — see
> their VCarve Job Setup 1220×2440 and the machine reference file X≤1220). `camJob.orient`
> now defaults to `'portrait'` and `tpXform` rotates coordinates (x_m = 1220−y,
> y_m = x) before the datum offset — all 5 datum labels now match the physical
> sheet corners. **Still pending an air-cut dry-run on the Pegasus before
> calling any NC fully known-good.** 2026-07-07 (Phase 2): rich-DXF, panels-DXF,
> template/toolchange NC and quote-snapshot goldens added; the standard NC
> goldens were byte-re-verified against current code at capture time.

## Files (expected byte sizes in parentheses)

**Standard job** — 12 plain parts, the base net:
| File | What |
|---|---|
| `GOLDEN_S1_18mm_datum-ll.nc` (8358) | Sheet 1 profile, T1, datum lower-left, Z-zero bed, portrait |
| `GOLDEN_S1_18mm_datum-c.nc` (8402) | Same sheet, datum centre — negative-coordinate transform |
| `GOLDEN_18mm.dxf` (4517) | Plain-rect DXF (parts + labels only) |
| `QUOTE_standard.json` (940) | Full `calcQuote()` — the "basket A" £300/£60/£360 |

**Rich doors job** — every door feature at once (recipe below):
| File | What |
|---|---|
| `GOLDEN_RICH_18mm.dxf` (10893) | Flushback rings (SHADOW/POKET_INSERT/IN_22MM/OUT_10MM), trad 2-panel cavities + GROOVE/LED_CHANNEL, OFFSET_A/B, SCRIBE, hinges, back sheet (custom backside A-only), glass opening (INSIDE), OFFCUT(+TEXT) |
| `GOLDEN_RICH_12mm.dxf` (4529) | Insert sheet — REEDED + flush insert |
| `GOLDEN_RICH_9mm.dxf` (2268) | Trad insert sheet |
| `GOLDEN_RICH_3mm.dxf` (2220) | Beading sheet — BEADING |
| `QUOTE_rich.json` (2205) | Doors + services (1/0.5/1h) + spray, panels.total = 0 (doors-only invariant) |
| `GOLDEN_TPL_S1_18mm.nc` (1525) | Factory flushback template on the 18mm sheet with Shadow enabled → **3 tool segments T1→T2→T1, real toolchanges**, rough-17/finish-18 pattern |
| `GOLDEN_TPL_S2_12mm.nc` (661) | Insert sheet contour (role filter proof — only insert parts) |

**Panels** — 2 rooms, chained walls, openings:
| File | What |
|---|---|
| `GOLDEN_PANELS_18mm.dxf` (10038) | 40/40 joint seam, matching shakers, door + window openings (window = INSIDE cut to the FLOOR at its column so the band never overlaps the lower panel — regenerated 2026-07-08), vertical columns, visual-order PART_NUMBERs. **Recipe pins `ow.bottom = 900`** — the window default is now the panel-band top (item 6, 2026-07-10), so the recipe fixes the old sill (900) to keep this file stable & byte-identical. |
| `QUOTE_mixed.json` (2774) | Rich doors + panels rooms combined (panels £2390 / 6 sheets, total £3665) |
| `GOLDEN_WALL_LAYOUT.dxf` (3428) | **Wall Layout DXF** (2026-07-10, regenerated for the **horizontal/panoramic** layout) — the non-cutting, front-view export: walls placed LEFT→RIGHT in app order, each full measured outline with its panels inside; wall label shows the measured wall size, panel labels the physical panel size. Layers `WALL`/`WALL_GAP`/`OUT`/`OFFSET_A`/`INSIDE`/`text`, no `SHEET`/`PART_NUMBER`. |

**Ogee Moulding 22mm** — the preset-gated toolpath template (2026-07-12):
| File | What |
|---|---|
| `GOLDEN_OGEE_S1_22mm.nc` (38555) | One 735×1720 22mm flat door, frame 50, **4 internal panels** (nests ROTATED), offset preset **Ogee** → `tplApply('tpl_ogee22')` → 5 segments T12(S12000 pocket raster 5.75/11.5, penultimate line at edge−step/2, serpentine reversed per level) → T1(S18000 ring 11.8) → T6(S16000 V 9.5, **CW from mid-right** + corner sharpen) → T11(S15000 ogee sweep) → T1(OUT **rough 10.5/21 at +0.4** + exact ramped FINAL 22). Regenerated 2026-07-12 after the VCarve-exactness fixes — validated field-by-field against BOTH VCarve references (`Ogee Moulding 22mm.nc` + small-job `Ogee Vcarve.nc`) |

`examples/*.fastcnc.json` are the SAME jobs as loadable files — `examples/rich-doors-and-panels.fastcnc.json` was round-trip-verified: cold load reproduces `QUOTE_mixed.json` exactly.

`.gitattributes` marks everything in this folder `-text`: NC is CRLF by machine contract; nothing here may be EOL-normalised by git.

## Recipes (reproduce byte-for-byte)

All recipes start from: serve the repo (`python -m http.server 8123`), load `/index.html` in a fresh browser context, run `localStorage.clear()` then reload. Then paste in the console:

### Standard job (NC ll/c + plain DXF + QUOTE_standard)

```js
items.length = 0; clearSel();
project.client='GOLDEN'; project.number='GOLDEN'; project.date='2026-01-01';
project.phone=''; project.email=''; project.notes='';
addTakeoffItems(parseTakeoffText("600 x 400 x 6\n715 x 495 x 2\n300 x 300 x 4"));
render();
// expect: calcQuote().partN === 12, 2 sheets 8x4, "MDF Hidrofugo Plus 18mm", total 360
const q = calcQuote();                       // -> QUOTE_standard.json (JSON.stringify(q,null,2)+'\n')
camPaths.length = 0;
camPaths.push({id:'tp_golden', on:true, kind:'profile', name:'Profile 1', toolId:'t1', params:tpDefaults()});
camJob.zZero='bed'; camJob.rapidGap=20; camJob.approach=5; camJob.orient='portrait';
camJob.datum='ll'; const ncLL = ncPegasus(tpSegsForSheet(tpSheets()[0]));
camJob.datum='c';  const ncC  = ncPegasus(tpSegsForSheet(tpSheets()[0]));
camJob.datum='ll';
const dxf = buildDxfByThickness()['18mm'];
```

### Rich doors job (RICH DXFs + QUOTE_rich + TPL NCs)

```js
items.length = 0; clearSel();
project.client='GOLDEN'; project.number='GOLDEN-RICH'; project.date='2026-01-01';
project.phone=''; project.email=''; project.notes='';
addTakeoffItems(parseTakeoffText("480 x 497 x 1\n600 x 1000 x 1\n500 x 700 x 1\n400 x 600 x 2\n350 x 350 x 1"));
upd(0,'type','flush');  setFrame(0,65); setHingeOn(0,true);          // the reference flushback geometry
upd(1,'type','trad');   setFrame(1,50); setPanels(1,2); setGrooveOn(1,true); setGrooveLedOn(1,true);
upd(2,'type','reeded'); setFrame(2,50); setReedOn(2,true);
setLineEn(3,1); setBackMode(3,'custom');                              // flat q2: line B front, custom back
items[3].backLines = items[3].backLines || JSON.parse(JSON.stringify(items[3].lines));
items[3].backLines.forEach((l,i)=>l.en=(i===0));                      // back = A only
items[3].scribe = {on:true};
upd(4,'type','trad'); setFrame(4,50); upd(4,'text','Glass');          // glass + beading
setSvc('design',1); setSvc('cutting',0.5); setSvc('assembly',1);
sprayOn(0,true);
render();
// expect: partN 11, 4 sheets, thicknesses 18/12/9/3mm, quote sub 664 / vat 133 / total 797
const files = buildDxfByThickness();          // -> GOLDEN_RICH_<th>.dxf
const qRich = calcQuote();                    // -> QUOTE_rich.json (panels.total must be 0)
// factory flushback templates -> toolchange NC:
clearSel(); camPaths.length = 0;
camJob.zZero='bed'; camJob.datum='ll'; camJob.rapidGap=20; camJob.approach=5; camJob.orient='portrait';
tplApply('tpl_flush18', true); tplApply('tpl_flushins12', true);      // 7 body + 2 insert ops
camPaths.find(p => /shadow/i.test(p.name)).on = true;                 // enable the T2 op
const ncTpl18 = ncPegasus(tpSegsForSheet(tpSheets()[0]));             // -> GOLDEN_TPL_S1_18mm.nc (T1,T2,T1 segs)
const ncTpl12 = ncPegasus(tpSegsForSheet(tpSheets()[1]));             // -> GOLDEN_TPL_S2_12mm.nc
```

### Panels rooms (PANELS DXF + QUOTE_mixed) — run AFTER the rich recipe, same page

```js
panelRooms.length = 0;
const r1 = pnNewRoom(1), r2 = pnNewRoom(2);
const w1 = pnNewWall(), w2 = pnNewWall(), w3 = pnNewWall();
w1.w = 2600; w1.sideR = 'joint';
w2.w = 2600; w2.sideL = 'joint';
w3.w = 2600; w3.dir  = 'v';
const od = pnNewOpening('door', w1);   od.x = 800;
const ow = pnNewOpening('window', w2); ow.x = 600; ow.bottom = 900;   // PIN: window default is now the band top; fix the old 900 sill to keep this golden stable
w1.openings = [od]; w2.openings = [ow];
r1.walls = [w1, w2]; r2.walls = [w3]; r2.name = 'Room 2';
// PIN the generated ids (pnNew* embeds Date.now() — unpinned ids break determinism of the examples):
r1.id='pr_g1'; r2.id='pr_g2'; w1.id='pw_g1'; w2.id='pw_g2'; w3.id='pw_g3'; od.id='po_g1'; ow.id='po_g2';
panelRooms.push(r1, r2); pnSave(); render();
// expect: Room 1 pieces "Wall 1A/1B/2A/2B", seam 40/40 at x=2600; panels quote 2390 / 6 sheets; total 3665
const pFiles = pnBuildDxfByThickness();       // -> GOLDEN_PANELS_18mm.dxf (key 'PANELS_18mm')
const qMixed = calcQuote();                   // -> QUOTE_mixed.json
```

### Wall Layout DXF (GOLDEN_WALL_LAYOUT.dxf) — item 7, its own tiny room

```js
panelRooms.length = 0;
const r = pnNewRoom(1); r.id='pr_wl'; r.name='Room 1';
const w1 = pnNewWall(), w2 = pnNewWall();
w1.w=2600; w1.h=3200; w1.sideR='joint'; w1.id='pw_wl1';
w2.w=1600; w2.h=3200; w2.sideL='joint'; w2.id='pw_wl2';
const od = pnNewOpening('door', w1); od.x=800; od.id='po_wl1'; w1.openings=[od];
r.walls=[w1,w2]; panelRooms.push(r); pnSave(); render();
const wl = pnWallLayoutDxf();                 // -> GOLDEN_WALL_LAYOUT.dxf (3428 bytes, LF)
// expect: HORIZONTAL — Wall 1 at x=0..2600, Wall 2 at x=2710..4310 (compact GAP=110, 2026-07-10); labels
// "Wall 1  wall 2600 x 3200", "Wall 2  wall 1600 x 3200"; panel labels "panel 800 x 1030" etc; layers
// WALL/OUT/OFFSET_A/INSIDE, NO SHEET. (This room has no room offset lines, so no OFFSET_B–G here — those only
// appear when room.lines are enabled; the writer now insets them inside each cavity like the Sheet DXF.)
```

### Ogee Moulding 22mm (GOLDEN_OGEE_S1_22mm.nc)

```js
items.length=0;clearSel();
items.push(mkItem('flat',735,1720,1,'MDF 22mm','8x4',{t:50,r:50,b:50,l:50},null,'OGEE TEST',{on:false},{offsetName:'None',panels:4}));
applyProfile(0,'Ogee');render();
camPaths.length=0;camJob.zZero='bed';camJob.datum='ll';camJob.rapidGap=20;camJob.approach=5;camJob.orient='portrait';
tplApply('tpl_ogee22',true);                  // 5 ops, all live
const nc=ncPegasus(tpSegsForSheet(tpSheets()[0]));   // -> GOLDEN_OGEE_S1_22mm.nc (38555, CRLF)
// expect: T12M6/S12000, T1M06/S18000, T6M06/S16000, T11M06/S15000, T1M06/S18000; z floor 0 only on the OUT final pass
```

### Getting bytes out of the browser

Base64 them (`btoa(unescape(encodeURIComponent(s)))`) and carry them out however
suits your tooling (local HTTP receiver, download, clipboard) — never through
anything that touches line endings. Quote JSONs are `JSON.stringify(q, null, 2) + '\n'`.

## Comparing (the regression check)

Regenerate with the same recipes into a scratch folder, then per file:

```bash
git diff --no-index tests/golden/<file> <scratch>/<file>
```

No diff = output unchanged. Any diff = itemise the changed lines, confirm the
change was requested, regenerate the goldens in the same commit, and note in
ROADMAP.md that machine/price output changed and why.
