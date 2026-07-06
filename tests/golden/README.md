# Golden files — CAM (.NC) + DXF regression net

These lock in the machine-facing output of the app for one fixed "standard job".
Any code change that alters these outputs will show up as a diff — which must be
**intended, itemised, and shipped together with regenerated goldens** (see
`/verify-kabacal` step 7 and CLAUDE.md "Guarded zones").

> **Status: compared against a real VCarve file (2026-07-06).** Regenerated after
> the pass-depth default changed to tool-based (T1 → 6mm → 3 passes; was 1mm →
> 18 passes). A side-by-side of `Vcarve Test.nc` vs `Kabacal Test.nc` for the same
> job confirmed: identical header/footer, final depth exactly Z0.000 (bed), no
> negative Z, same radius compensation. Still pending an actual dry-run on the
> Pegasus before calling it fully known-good.

## Files

| File | What |
|---|---|
| `GOLDEN_S1_18mm_datum-ll.nc` | Sheet 1 profile cut, T1 6mm, datum lower-left (default), Z-zero bed |
| `GOLDEN_S1_18mm_datum-c.nc` | Same sheet, datum centre (exercises the negative-coordinate transform) |
| `GOLDEN_18mm.dxf` | DXF export of the whole job (plain rect parts + labels; hinge/groove/offcut layers NOT exercised — extend with a richer variant when DXF work resumes) |

`.gitattributes` marks these `-text`: the NC files are CRLF by machine contract and
must never be EOL-normalised by git.

## Exact recipe (reproduce byte-for-byte)

1. Serve the repo, load `/index.html` in a **fresh** browser context and run
   `localStorage.clear()` then reload (default `toolDb`, default favourites).
2. In the page (preview_eval / console):
   ```js
   items.length = 0; clearSel();
   project.client='GOLDEN'; project.number='GOLDEN'; project.date='2026-01-01';
   project.phone=''; project.email=''; project.notes='';
   addTakeoffItems(parseTakeoffText("600 x 400 x 6\n715 x 495 x 2\n300 x 300 x 4"));
   render();
   // expected state: calcQuote().partN === 12, 2 sheets 8x4, material "MDF Hidrofugo Plus 18mm"
   // (fresh-load default), no services, no spray, VAT on
   camPaths.length = 0;
   camPaths.push({id:'tp_golden', on:true, kind:'profile', name:'Profile 1', toolId:'t1', params:tpDefaults()});
   camJob.zZero='bed'; camJob.rapidGap=20; camJob.approach=5;
   camJob.datum='ll'; const ncLL = ncPegasus(tpSegsForSheet(tpSheets()[0]));
   camJob.datum='c';  const ncC  = ncPegasus(tpSegsForSheet(tpSheets()[0]));
   camJob.datum='ll';
   const dxf = buildDxfByThickness()['18mm'];
   ```
3. Write `ncLL`, `ncC`, `dxf` to the three files **byte-exact** (base64 them out of
   the browser; do not paste through anything that touches line endings).
4. Expected sizes (after the tool-based pass-depth change): ll = 8388 bytes ·
   c = 8438 bytes · dxf = 4517 bytes. (Before, with the old 1mm default:
   40279 / 40509 / 4517 — the NC shrank ~5× because 18 passes became 3.)

## Comparing (what /verify-kabacal does)

Regenerate into the scratchpad with the same recipe, then:

```bash
git diff --no-index tests/golden/GOLDEN_S1_18mm_datum-ll.nc <scratch>/ncLL.nc
git diff --no-index tests/golden/GOLDEN_S1_18mm_datum-c.nc  <scratch>/ncC.nc
git diff --no-index tests/golden/GOLDEN_18mm.dxf            <scratch>/dxf.dxf
```

No diff = machine/DXF output unchanged. Any diff = itemise the changed lines,
confirm the change was requested, regenerate the goldens in the same commit, and
add a ROADMAP note saying the machine output changed and why.
