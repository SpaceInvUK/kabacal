# Kabacal — project instructions

Single-file CNC order-entry / nesting / DXF / CAM app for FAST CNC.
Everything lives in `index.html` (inline CSS + ONE inline `<script>`, ~390 functions, global state).
Published via GitHub Pages: https://spaceinvuk.github.io/kabacal/ (push to `main` = deploy).

**Keep it a single file. No build system, no npm dependencies, no frameworks — unless explicitly requested.**

## Commands

- `node tools/check.mjs` — syntax + production-invariant tripwire. Run after every edit to `index.html`; must pass before any commit.
- Preview: `preview_start` with config `kabacal` (python http.server on 8123), or `python -m http.server 8123 --bind 127.0.0.1`.
- Business rules that are confirmed with the user live in `KABACAL_RULES.md` — read it before touching nesting/offcut/DXF. New confirmed rules go there.
- Every shipped change gets a dated entry at the TOP of `ROADMAP.md` (Portuguese ok, include a "Testado" list of what was actually verified).

## Map (anchor by function name, not line number)

| Area | Key functions / consts |
|---|---|
| Item model | `mkItem`, `resolveFrame`, `cavityOf`, `grooveOf`, `hingePositions`, `insertSpecFor`, `beadingOf` |
| Persistence (.fastcnc) | `loadFastCnc`, `buildFastCnc`, `downloadFastCnc` |
| DXF writer | `DXF_LAYERS`, `dxfForThickness`, `buildDxfByThickness`, `downloadDxf`, `dxfText/Line/Poly/Rect` |
| Materials + prices | `PRICES`, `SHEETS`, `priceForSheet`, `cncForThickness`, `priceOverrides` |
| Order-entry UI | `render`, `renderInspector`, `sel`, `applyField`, `tabPart/tabOffset/tabHinges/tabSpray` |
| Zoom / edit overlay | `openZoom`, `toggleZoomEdit`, `setupZoomPanZoom`, `nestClick` |
| Nesting engine | `mrInsert`, `mrPackBins`, `autoPack`, `packMulti`, `repackSheetToSize`, `materialize`, `buildSheetGroups` |
| Offcuts | `offcutEmptyRects`, `offcutForSheet`, `offcutTrace`, `offcutChamfer`, `offcutUsable` |
| Nest rendering | `renderNest`, `drawPart`, `woodgrainSvg`, drag handlers |
| Takeoff + DXF import | `parseTakeoffLine`, `parseTakeoffText`, `addTakeoffItems`, `readDxfEntities`, OCR via `loadTesseract` |
| Labels + checklist | `collectPartLabels`, `cncLabelSvg`, `labelMap*`, `a4Labels*`, `buildChecklistTsv`, QR (`qr*`) |
| CAM / Toolpaths (VCarve-style panel) | state: `toolDb` (kab_tooldb), `camJob` (zZero/datum/gaps), `camPaths` (tree), `tpDefaults`; engine: `ringPts`, `ringWalker`, `emitLapFrom`, `emitRampThenLap`, `tpPartMoves`, `tpOrderParts`, `tpSegsForSheet`, `tpDatumOff`, `ncPegasus(segs)`; UI: `tpCalc`, `tpDownloadNC`, `openToolDb`, `renderToolpaths` |
| Quote + VAT | `calcQuote`, `sprayCalc`, `machOf`, `setSvc`, `toggleVat`, `setPriceOv` |
| Print docs | `buildQuoteHtml`, `buildCutListHtml`, `openQuoteDoc`, `openCutList`, `openPrintWindow` |
| App meta | `snapshot/undo/redo`, `validateOrder`, `applyTheme`, `genOrderNumber`, `setView` |

## Guarded zones — evidence required before commit

These produce customer prices, machine files, or factory paperwork. Changes here need **before/after proof shown to the user**, not just "it looks right":

1. **Pricing / quote** (`calcQuote`, `priceForSheet`, `cncForThickness`, `sprayCalc`, `machOf`, services rates, VAT) → run `/pricing-impact` (before/after totals table on the standard basket). Production rules that must survive any refactor: MDF 18mm on 10x4 = £75 exact; spray never enters the group discount base; VAT = 20% of sub; design £35/h, cutting £25/h, assembly £50/h, machine time £250/h.
2. **DXF export** (`dxfForThickness`, `buildDxfByThickness`, `DXF_LAYERS`) → export before/after DXF for the same job and diff; layer names are a contract with the VCarve gadgets — never rename/remove layers.
3. **CAM / .NC output** (`ncPegasus`, `tpPartMoves`, `tpSegsForSheet`, `tpDatumOff`, `ringPts`, `emitLapFrom`, `emitRampThenLap`, `camJob`/`toolDb`/`tpDefaults`) → diff generated .NC against `tests/golden/` before/after; header `% / :1248 / G90`, toolchange block, footer `G53Z0 … M05M30`, modal coords, CRLF, datum signs and the James cutting pattern (ramp 100mm, separate last pass 0.4mm, tabs off) are validated against the real machine. A wrong .NC can crash a physical machine — be paranoid.
4. **Nesting / offcuts** (MaxRects + `offcut*`) → part-count conservation (no part lost, no phantom sheet), rules in `KABACAL_RULES.md` (7mm margin/gap, offcut min sizes, L-shape only, 3mm chamfer on the drawn line).
5. **Quote / cut-list documents** (`buildQuoteHtml`, `buildCutListHtml`) → before/after print preview screenshots.

`tools/check.mjs` trips on the cheapest-to-break of these invariants, but passing it is necessary, not sufficient.

## Safety rules

- Never commit if `node tools/check.mjs` fails. Never force-push. Never rewrite git history.
- Do not rewrite or "clean up" large parts of the app unless explicitly asked; make the smallest change that satisfies the request.
- `.fastcnc.json` files already saved by users must keep loading — `loadFastCnc` must stay backward compatible (add fields, don't repurpose them).
- localStorage keys are prefixed `kab_` — renaming one silently wipes user data; don't.
- UI text is English; ROADMAP/rules notes may be Portuguese.
- After a completed, verified change: commit + push without asking (established rule for this repo). "Completed" means check passed AND the relevant verification (below) ran.

## Verification workflow (what "tested" means here)

For any user-visible change, before committing:
1. `node tools/check.mjs`
2. Serve + open the app, check console for errors
3. Seed a real job (takeoff paste or `.fastcnc`), exercise the changed feature
4. Runtime spot-invariants: `priceForSheet('MDF 18mm','10x4') === 75`; part count in `calcQuote().partN` matches seeded; NC text starts `%\r\n:1248` and ends `M05M30`; DXF from `buildDxfByThickness()` contains the expected layers
5. **Golden diff**: regenerate the standard job's .NC + DXF and diff against `tests/golden/` (procedure in `tests/golden/README.md`). Differences must be intended, itemised, and the goldens regenerated in the same commit.
6. Screenshot the changed UI
The `/verify-kabacal` skill runs this end-to-end.

## Agents & skills

Subagents (`.claude/agents/`): **pricing-guard**, **dxf-nesting-reviewer**, **cam-reviewer** — read-only reviewers for the guarded zones. Use them to review a diff before shipping; they never edit files.

Skills (`.claude/skills/`): **/verify-kabacal** (runtime smoke test), **/pricing-impact** (before/after quote table vs HEAD), **/deploy-kabacal** (checked commit + push + Pages confirm).

## Day-to-day workflow

- **Bug fix / small feature**: edit → `check.mjs` → `/verify-kabacal` → commit+push (or `/deploy-kabacal`).
- **Anything touching a guarded zone**: edit → check → matching reviewer subagent on the diff → `/pricing-impact` or before/after DXF/NC/PDF evidence → show user the impact → commit+push.
- **Experiments / risky spikes (e.g. CAM two-pass)**: separate branch or worktree, merge only after verification on the branch.

## Parallel work rules

The whole app is one file with shared global state (`items`, `placements`, `render()`), so:
- **One writer at a time.** Two Claude sessions editing `index.html` in parallel will produce painful merge conflicts.
- Parallel is fine when only one stream writes: implementation + read-only review agents, or implementation + planning/audit of the next task.
- Use a git branch/worktree for a risky experiment; keep `main` shippable. Do not run two feature worktrees for long — rebase pain grows with every commit to `main`.
- If genuinely parallel workstreams are ever needed, the file must first be split into modules — that is an explicit user decision (it changes the deploy story), not something to do on the fly.
