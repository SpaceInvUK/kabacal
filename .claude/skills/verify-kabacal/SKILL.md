---
name: verify-kabacal
description: Runtime smoke test for Kabacal — serve the app, seed a standard job, exercise order entry, nesting, quote, DXF, labels and toolpaths, and check the production invariants. Use after any edit to index.html, before committing, or when asked to "verify", "test the app", or "check nothing broke".
---

Run the whole flow below with the preview tools; never ask the user to test manually. Fix-and-rerun on failure: diagnose in source, edit, re-run from step 1.

## Steps

1. **Static check**: `node tools/check.mjs` — must print `kabacal check ok`.
2. **Serve**: `preview_start` config `kabacal` (port 8123). Load `/index.html` (reload if already open). `preview_console_logs` level=error must be clean at idle.
3. **Seed the standard job** via `preview_eval` using the app's own functions (top-level `function` declarations are on `window`; `let` state like `items` is NOT — go through functions only):
   - `addTakeoffItems(parseTakeoffText("600 x 400 x 6\n715 x 495 x 2\n300 x 300 x 4"))` — then confirm via `calcQuote().partN === 12`. If the parse shape differs, inspect `parseTakeoffLine` and adapt; the goal is 3 groups / 12 parts of MDF 18mm.
   - Make the 715×495 pair a shaker with hinges: use the setter functions (`setFrameSide`/`setFrame`, `setHingeOn`, `setHingeCount`) on those items' indexes, mirroring what the inspector UI calls (read `tabOffset`/`tabHinges` onclick handlers for exact signatures).
   - Services: `setSvc('design',1)`.
4. **Runtime invariants** (`preview_eval`, all must hold):
   - `priceForSheet('MDF 18mm','10x4') === 75` (production special price)
   - `priceForSheet('MDF 18mm','8x4') === 55` (table price)
   - `calcQuote()`: `partN` matches seeded count; `total === sub + (vatOn ? vat : 0)`; `vat === Math.round(sub*0.2)`; `svc.design === 35`.
   - Part conservation: sum of parts across `buildSheetGroups()` sheets (excluding `isBack`) equals `calcQuote().partN`.
5. **DXF**: `const f = buildDxfByThickness(); Object.keys(f)` — expect `['18mm']`; the string must contain `PART_NUMBER` and `SHEET` layers, and every part label. If any item has groove/offcut expectations, check `GROOVE`/`OFFCUT`/`OFFCUT_TEXT` appear when (and only when) applicable.
6. **Toolpaths**: `const s = flatSheets(); const nc = ncPegasus(cam.toolNum, cam.spindle, camMovesForSheet(s[0]));` — assert `nc.startsWith('%\r\n:1248\r\nG90')`, `nc.trimEnd().endsWith('M05M30')`, and it contains `F8000` and `F3000`.
7. **Views**: switch through Order → Quote (`setView('quote')` or click) → Sheets/zoom → Toolpaths tab → open Checklist (`buildChecklistTsv()` returns non-empty with 12 parts). After each: `preview_console_logs` errors must be clean.
8. **Visual**: `preview_screenshot` of the view most affected by the change (both themes via `toggleTheme()` if CSS was touched).

## Report

Checklist table (step → pass/fail), console-error summary, the calcQuote totals for the standard job, and the screenshot. If ANY invariant fails, the change is NOT done — do not commit.
