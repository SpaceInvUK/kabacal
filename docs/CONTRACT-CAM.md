# CAM / .NC machine contract — Pegasus 1530 (Syntec)

**Update when:** the post format, machine setup, or cutting pattern deliberately changes — which requires the user's explicit confirmation against the machine. This file is the source of truth; `.claude/agents/cam-reviewer.md` is just a wrapper around it.
**Validation status: see STATUS.md** — file-diff validated vs real VCarve output; physical air-cut still pending.

## The machine

- **Pegasus 1530 · OPUS CNC · Syntec control.** Sheet mounts **PORTRAIT**: machine X runs across the 1220 side, Y along 2440 (VCarve Job Setup 1220×2440; machine reference file has X≤1220).
- Kabacal nests landscape, so `tpXform` rotates every coordinate into the machine frame — **x_m = 1220 − y, y_m = x** — before the datum offset. `camJob.orient` defaults to `'portrait'`. Datum labels (ll/lr/c/ul/ur) refer to the physical sheet corners after this rotation.
- Arcs (when implemented) are **I/J incremental**. The second machine (Fabertec/Parkingm2) uses **R-format** arcs and needs its OWN post-processor — never mix the two.
- Z-zero default = **machine BED** (`topZ = thickness`); 'surface' mode flips to topZ = 0 and cuts negative.
- Real tools (factory `toolDb`, extracted from the VCarve library): T1 = 6mm cutter F8000/plunge F3000/S18000, **passDepth pinned to 6** (the machine reference job cuts 18mm in 3×6mm; the VCarve DB value 25 is kept as `passDepthDb`) · T2 2mm · T4 4mm · T6 V-bit 90° · T8 ball 8mm · T12 pocket clear.

## NC file format (validated byte-for-byte vs the machine reference .nc)

- **Header**, in order: `%`, `:1248`, `G90`, then N-numbered `G0X0Y0`, `G40G17G80G49`.
- **Per tool segment**: first segment `T{n}M6`; every later segment is preceded by `G53Z0` and uses `T{n}M06`; then `G90G54`, `G43H{n}`, `G0X0.000Y0.000S{rpm}M3`. Modal X/Y reset to 0 and **Z/F modal state reset to null at every toolchange** (`md.Z=null; md.F=null`) — losing that reset silently drops the first Z or F after a toolchange.
- **Footer**: `G53Z0`, `M05`, `T1M06`, `G90G54`, `G43H1`, `G0X0.000Y0.000`, `G49H0`, `G0X0Y0`, `G55X0Y0`, `M05M30`.
- N-numbers step by 10. Coordinates are **MODAL** (emitted only when they change). XYZ `%.3f`, F `%.1f`. **CRLF** line endings; file ends with CRLF.
- Consecutive toolpaths using the same tool number **merge into one segment** (no redundant toolchange) — VCarve behaviour.
- Per-sheet file naming: `{ORDER}_S{i}_{th}mm.nc` (`tpDownloadNC`).

## Cutting pattern (production defaults, `tpDefaults` — the reference-job pattern)

- **Pass depth comes from the TOOL** (`tool.passDepth`; T1 → 6 → 3 passes through 18mm). `passes` overrides the count when set.
- Rough passes run at offset `±(r + allowance + lastPass.val)`; with `lastPass.on` (default ON, **0.4mm**) a SEPARATE final lap runs at exact `±(r + allowance)` with a straight vertical plunge to full depth.
- **Ramp** (default ON, 100mm): Z interpolates from startZ to the pass floor along the perimeter at PLUNGE feed with modal F (`G1Z…F3000` → `G1X…Z…` → cutting F appears on the lap), then the lap runs, then the ramp span is **re-covered** at full pass depth.
- **Tabs default OFF** (vacuum table). When on: spans lift to `finalZ + tabs.th`, only on passes below tab top.
- `cutDepth` defaults to the sheet thickness; `addDepth` (default off, 0.2) extends it. Final floor = `topZ − cutDepth(−addDepth)`; **nothing ever cuts deeper**, and cutting into the bed must produce the existing warning, never silence.
- Machining order default narrow-first; the ring is a CCW 8-anchor loop starting at the chosen anchor.
- **Per-piece templates** (`tpl*`): a flushback door gets TWO templates — body 18mm (rough 17 LIVE → pockets/shadow ops OFF by default → FINISH 18 LIVE, releasing the piece LAST) and insert 12mm. `params.role` (`body`/`insert`) is **MANDATORY** — without it a body op would cut the 12mm insert sheet 6mm into the spoilboard (proven collision: part keys `3_0`/`3_0_i` under `parseInt`). VCarve `.ToolpathTemplate` binaries store the op tree **REVERSED** — always invert when converting (rule in KABACAL_RULES.md).

## Op kinds beyond profile-on-OUT (2026-07-12, Ogee Moulding 22mm)

- **Geometry resolver `tpOpRects`**: OUT / any non-OFFSET layer = the part outline (legacy — SHADOW etc. unchanged); `OFFSET_A..G` = the part's **cavities** inset by that line's mm (DXF-writer maths). Template ops on offset lines go LIVE only when a target part actually has that line enabled (`tplApply` hasGeo check) — flushback's off-by-default pocket ops stay off.
- **Profile extras (all additive params, absent = exact legacy behaviour)**: `depthList` (rough Z ladder; explicit `cutDepth` wins for the final floor) · `feed`/`plunge` per-op overrides (match a reference NC over the tool DB) · `vbit:{deg}` = effective radius `cutDepth·tan(deg/2)` (V flank meets the surface ON the line; 90°@9.5 → r9.5) · `cornerSharpen` (**enters MID-RIGHT, ramps DOWN the right side, runs CW**, sharpens BR→BL→TL→TR out to the layer-line corner at the surface, re-covers the ramp — the exact "Ogee Vcarve.nc" order) · `rampLast` (the exact final pass ramps in like VCarve OUT instead of the legacy vertical plunge). **VCarve OUT pattern** = `cutDepth:22, depthList:[10.5,21], lastPass:{on,val:0.4}, rampLast` → roughs at +0.4, exact ramped final at r.
- **`kind:'pocket'`** (T12 50.8 skim): per depth level (`depths:[5.75,11.5]`), there-and-back ramp on that level's first raster line, serpentine raster (`stepover` 25.4 = 50%, **direction reverses each level**, **penultimate line at edge − step/2** — VCarve line rule), then the boundary ring at `r+allowance`; `rasterInset` (default r·0.2) matches the VCarve grid inset.
- **`kind:'sweep'`** (T11 ball 5mm): rings stepped OUTWARD from the op's layer ring (rails, OFFSET_E), Z follows the offset preset's PROFILE section (`params.profile` copied from `profiles[name].profile` at apply time) with **ball-nose tip projection** (max over ±r window; never above topZ), constant arc step (`stepover` 0.75). **Deliberate exception to rapid rule 1**: between rings the tool lifts `G0 Z(prev+liftZ)` INSIDE the just-cut groove (pure-Z up, XY moves at feed) — exactly what the VCarve reference NC does; XY rapids below appZ remain forbidden.
- **Template gating**: `appliesTo.offsetName` (with `th`) restricts a template to parts carrying that offset preset; the template list shows blocked templates greyed with the reason (`tplBlockReason`: "needs 22mm material" / "needs the Ogee offset preset").
- Machine tools confirmed by Ednei 2026-07-12: **T11 = ball nose 5mm (S15000 F10000/5000)**, **T12 = 50.8 skimming (S12000 F9000/3000)** — added to the factory toolDb (ids `t11ball5`/`t12skim508`; note: re-running the xlsx pipeline must re-add them).
- **Tool resolution (real bug, "Ogee Kabacal.nc" 2026-07-12)**: an older SAVED `kab_tooldb` lacked the two new ids and the num-only fallback grabbed a 2mm "T12"@S5000 / 6mm "T11"@S18000. Fixes: (1) boot **seeds** missing factory-template tool ids into the saved library (additive; user edits by id always win); (2) `tplResolveTool` tries **num+dia** (±0.6) before num-only. Template ops should always carry `tool:{id}` — id beats everything and is unambiguous.
- **Known cosmetic differences vs VCarve** (accepted): ring laps emit the 8-anchor mid-side vertices (collinear — same path, extra NC lines); sweep ring spacing is our constant-arc sampling (±0.3mm vs VCarve's sampler, Z ends/extremes exact); pocket/level entry corners may differ in parity. Everything dimensional (rings, depths, feeds, speeds, order, ramps, corner sharpening) matches the references.

## Safety checklist (apply to every CAM diff)

1. Rapids (`G0`) only at `safeZ`/`appZ` — never at or below material top. Plunges/ramps at tool plunge feed; laps at tool feed.
2. First cut move after any rapid repositioning carries F (modal F resets per toolchange).
3. Floor arithmetic: `finalZ = topZ − cutDepth(−addDepth)`; nothing deeper; bed-cut warning intact.
4. Offset sign: outside = +r, inside = −r, 'on' = 0; rough vs final offsets differ by exactly `lastPass.val`.
5. Part + offset stays inside sheet bounds pre-datum; centre/right/upper datums legitimately emit NEGATIVE coordinates — never "fix" them; datum and orient transform X/Y only, **never Z**.
6. Ring starts at the chosen anchor, runs CCW; the re-cover span exactly closes the ramp gap.
7. Scope/role filters only ever FILTER parts — never duplicate, never invent; back parts (`isBack`) excluded.

## Evidence

Golden NC files in `tests/golden/` (standard ll/c + template toolchange pair) must diff clean, or the change is itemised + goldens regenerated in the same commit (recipes in `tests/golden/README.md`). For anything touching Z, feeds, datum, or the post format: recommend an air-cut (Z offset up) before real material.
