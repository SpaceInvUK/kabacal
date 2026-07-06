---
name: pricing-impact
description: Before/after quote comparison for Kabacal pricing changes — runs the working-tree app and the last-committed (HEAD) app side by side on the same standard basket and tables every price difference. REQUIRED before committing any change to calcQuote, priceForSheet, cncForThickness, sprayCalc, machOf, services, VAT, or the PRICES table.
---

Produce a before/after pricing table proving exactly which customer-facing numbers a change moves. "Before" = HEAD, "after" = working tree.

## Steps

1. **Baseline copy**: `git show HEAD:index.html > tools/_baseline.html` (it is gitignored). If HEAD already equals the working tree, say so and stop.
2. **Serve**: `preview_start` config `kabacal`.
3. **Capture — run this identical script on BOTH** `/index.html` and `/tools/_baseline.html` (navigate via `preview_eval` `window.location`, wait for load) using `preview_eval`:
   - Seed the standard basket (same recipe as /verify-kabacal): takeoff `600 x 400 x 6`, `715 x 495 x 2` (as shaker + 2 hinges each), `300 x 300 x 4`, all MDF 18mm; `setSvc('design',1)`; spray on for one group if spray code was touched.
   - Record:
     - `Q = calcQuote()` → `partN, sheetN, matTot, cncTot, bodyTot, svcTot, spray.total, sub, vat, total` and each `rows[i]` → `{mat, sheets, mc, base, cncEff, pocketPct, drillPct, timeCost, disc, total}`
     - Probes: `priceForSheet('MDF 18mm','8x4')`, `priceForSheet('MDF 18mm','10x4')`, `priceForSheet('MR MDF 18mm','8x4')`, `priceForSheet('Birch Ply 18mm','10x5')`, `cncForThickness('MDF 18mm')`, `cncForThickness('MDF 12mm')`, `cncForThickness('Birch Ply 24mm')`
     - VAT both ways: `total` with `vatOn` true and false (use `toggleVat()` and restore).
4. **Diff**: build one table — metric | before | after | Δ. Include every row, not only changed ones.
5. **Cleanup**: delete `tools/_baseline.html`.

## Verdict

- **No movement**: all Δ = 0 → safe on this axis (note: the basket doesn't cover every material/override combination — say so).
- **Movement**: list each changed number with the code path that changed it, and state plainly whether the user asked for that change. Unrequested movement = do not commit; fix first.
- Paste the table in the conversation — the user must SEE the impact before anything ships.
