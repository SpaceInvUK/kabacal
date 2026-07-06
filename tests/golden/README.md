# Golden files — CAM (.NC) + DXF regression net

These lock in the machine-facing output of the app for one fixed "standard job".
Any code change that alters these outputs will show up as a diff — which must be
**intended, itemised, and shipped together with regenerated goldens** (see
`/verify-kabacal` step 7 and CLAUDE.md "Guarded zones").

> **Status: known STATE, not yet known GOOD.** Captured from the app at commit
> `9582af0` (CAM Phases 1–3). The .NC has not yet been dry-run against the real
> machine / compared with VCarve output for the same part. After that validation,
> treat these as known-good.

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
4. Expected sizes as of `9582af0`: ll = 40279 bytes · c = 40509 bytes · dxf = 4517 bytes.

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
