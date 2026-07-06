---
name: verify-kabacal
description: Runtime smoke test for Kabacal — serve the app, seed a standard job, exercise order entry, nesting, quote, DXF, labels and toolpaths, and check the production invariants. Use after any edit to index.html, before committing, or when asked to "verify", "test the app", or "check nothing broke".
---

Run the whole flow below with the preview tools; never ask the user to test manually. Fix-and-rerun on failure: diagnose in source, edit, re-run from step 1.

## Steps

1. **Static check**: `node tools/check.mjs` — must print `kabacal check ok`.
2. **Serve**: `preview_start` config `kabacal` (port 8123). Load `/index.html` (reload if already open). `preview_console_logs` level=error must be clean at idle.
3. **Seed the standard job** via `preview_eval` using the app's own functions (top-level `function` declarations are on `window`; top-level `let` state like `items`/`camPaths` is not a window property but IS reachable as a bare identifier in eval):
   - `addTakeoffItems(parseTakeoffText("600 x 400 x 6\n715 x 495 x 2\n300 x 300 x 4"))` — then confirm via `calcQuote().partN === 12`. If the parse shape differs, inspect `parseTakeoffLine` and adapt; the goal is 3 groups / 12 parts of MDF 18mm.
   - Make the 715×495 pair a shaker with hinges: use the setter functions (`setFrameSide`/`setFrame`, `setHingeOn`, `setHingeCount`) on those items' indexes, mirroring what the inspector UI calls (read `tabOffset`/`tabHinges` onclick handlers for exact signatures).
   - Services: `setSvc('design',1)`.
4. **Runtime invariants** (`preview_eval`, all must hold):
   - `priceForSheet('MDF 18mm','10x4') === 75` (production special price)
   - `priceForSheet('MDF 18mm','8x4') === 55` (table price)
   - `calcQuote()`: `partN` matches seeded count; `total === sub + (vatOn ? vat : 0)`; `vat === Math.round(sub*0.2)`; `svc.design === 35`.
   - Part conservation: sum of parts across `buildSheetGroups()` sheets (excluding `isBack`) equals `calcQuote().partN`.
5. **DXF**: `const f = buildDxfByThickness(); Object.keys(f)` — expect `['18mm']`; the string must contain `PART_NUMBER` and `SHEET` layers, and every part label. If any item has groove/offcut expectations, check `GROOVE`/`OFFCUT`/`OFFCUT_TEXT` appear when (and only when) applicable.
6. **Toolpaths** (VCarve-style panel API): create a default profile toolpath and post it:
   ```js
   camPaths.length = 0; camJob.datum='ll'; camJob.zZero='bed';
   camPaths.push({id:'tp_verify', on:true, kind:'profile', name:'Profile 1', toolId:'t1', params:tpDefaults()});
   const nc = ncPegasus(tpSegsForSheet(tpSheets()[0]));
   ```
   Assert `nc.startsWith('%\r\n:1248\r\nG90')`, `nc.trimEnd().endsWith('M05M30')`, contains `F8000.0` and `F3000.0`, and no `G0Z` line at or below material top (18).
7. **Golden diff** (regression net for CAM + DXF): follow `tests/golden/README.md` — seed exactly its recipe (GOLDEN project fields, default toolDb), capture sheet-1 NC (datum ll AND datum c) plus the 18mm DXF, write them to the scratchpad, then `git diff --no-index` each against `tests/golden/`. Any difference = the change altered machine/DXF output: itemise the changed lines, confirm they are intended, and regenerate the goldens in the same commit — otherwise FAIL.
8. **Views**: switch through Order → Quote (`setView('quote')` or click) → Sheets/zoom → Toolpaths tab → open Checklist (`buildChecklistTsv()` returns non-empty with 12 parts). After each: `preview_console_logs` errors must be clean.
9. **Visual**: `preview_screenshot` of the view most affected by the change (both themes via `toggleTheme()` if CSS was touched).

## Report

Checklist table (step → pass/fail), console-error summary, the calcQuote totals for the standard job, golden-diff result, and the screenshot. If ANY invariant fails, the change is NOT done — do not commit.
