# Kabacal — instructions for AI coding agents (and humans)

**Read this file first, whatever model you are.** Then read `STATUS.md` (where we are, open risks, decisions). Then the doc for the area you're touching (Reading order, below). Do not rely on any conversation memory — the repo files are the only source of truth.

## What this is

Single-file web app — `index.html`, inline CSS + ONE inline `<script>` (~5,700 lines) — for FAST CNC: door & wall-panel order entry, quoting, sheet nesting, offcut detection, DXF export, CAM toolpaths and Pegasus/Syntec `.NC` machine code. Live at https://spaceinvuk.github.io/kabacal/ — **push to `main` IS the production deploy** (GitHub Pages).

Family: `cnc-calculator` repo = the production calculator Kabacal stays file-compatible with (`.fastcnc`); the VCarve gadgets (in the "CNC App" repo) consume our DXF layers; `Kabacal 3D/` = prototype whose confirmed rules were merged into `KABACAL_RULES.md`.

## Iron rules

1. **Never commit if `node tools/check.mjs` fails.** Never force-push. Never rewrite git history.
2. **Guarded zones (table below) need before/after evidence** — goldens diff, basket totals, screenshots — not "it looks right".
3. **Never rename** DXF layer names, `kab_*` localStorage keys, or `.fastcnc` fields. Persistence changes are **additive only** — files saved by old versions must keep loading.
4. Smallest change that satisfies the request. No drive-by refactors, no "cleanup" of working code, no new dependencies, no build step, **keep it one file** — unless the user explicitly changes this rule.
5. The comment markers `/*PN_ENGINE_START*/…END*/` and `/*TOOLDB_START*/…END*/` are **parsed by tools** (`check.mjs`, `embed-tooldb.mjs`). Never remove, rename, or move them.
6. **One writer at a time on `index.html`** — see Session protocol. A real two-session merge incident has already happened here.
7. After each completed, **verified** change: commit + push without asking. Add a dated entry at the TOP of `ROADMAP.md` (Portuguese ok) with a "Testado" list of what you actually verified.
8. `KABACAL_RULES.md` is the confirmed business-rule book — read it before touching nesting, offcuts, DXF, panels, or machining templates. New user-confirmed rules go there (and nowhere else).
9. UI text is English; ROADMAP/rules may be Portuguese.
10. Before ending a session: update `STATUS.md` if risks / decisions / in-flight work changed, and delete `.session.lock`.

## Guarded zones — evidence required before commit

| Zone | Anchors (grep these) | Required evidence |
|---|---|---|
| Pricing / quote | `calcQuote`, `priceForSheet`, `cncForThickness`, `sprayCalc`, `machOf`, `pnQuote`, `pricingCfg` (formula mode), `PRICES` | Before/after totals on the standard baskets (see tests/golden/README.md seed); any delta itemised and user-approved |
| DXF export | `dxfForThickness`, `buildDxfByThickness`, `pnDxfForThickness`, `DXF_LAYERS` | Golden diff (`tests/golden/`); layer names untouched |
| CAM / .NC | `ncPegasus`, `tpPartMoves`, `tpSegsForSheet`, `tpXform`/`tpDatumOff`, `tpl*` templates, `camJob`/`toolDb` | Golden diff + machine contract in `.claude/agents/cam-reviewer.md` (until `docs/CONTRACT-CAM.md` exists). Output runs on a **real machine** — be paranoid |
| Nesting / offcuts | `mrInsert`, `autoPack`, `packMulti`, `offcut*`, `pnLayoutRoom`/`pnNestRoom` | Part-count conservation; rules in `KABACAL_RULES.md`; Panels engine tests in `check.mjs` green |
| Print docs | `buildQuoteHtml`, `buildCutListHtml` | Before/after print screenshots |

**Production rules that must survive any refactor:** MDF 18mm on a 10x4 sheet = **£75 exact** · spray never enters the group-discount base · VAT = 20% of sub · rates: design £35/h, cutting £25/h, assembly £50/h, machine £250/h · Panels CNC service £330/sheet · a Doors-only job is **byte-identical** with Panels empty.

## Map (function-name anchors — navigate by grep, not line numbers)

| Area | Anchors |
|---|---|
| Doors item model | `mkItem`, `resolveFrame`, `cavityOf`, `pnlOf` (internal door panels), `grooveOf`, `hingePositions`, `insertSpecFor`, `beadingOf` |
| Persistence (.fastcnc) | `loadFastCnc`, `buildFastCnc` — additive fields: `kabacal`, `kabacalQuote`, `panelRooms`, `camPaths`/`camTools`/`camJob`, `kabBackMode`/`kabBackLines`, per-item `panels`/`panelSize`/`frameMiddle` |
| DXF writers | doors: `DXF_LAYERS`, `dxfForThickness`, `buildDxfByThickness` · panels: `pnDxfForThickness` (`PANELS_<th>.dxf`) |
| Materials + pricing | `PRICES`, `SHEETS`, `priceForSheet`, `cncForThickness`, `priceOverrides`, `customMats`, `pricingCfg` (Production vs Website-formula), `companyCfg` |
| Order-entry UI | `render`, `renderInspector`, `sel`/`selInst`, `applyField`, `tabPart`/`tabOffset`/`tabHinges`/`tabSpray` |
| Nesting engine | `mrInsert`, `mrPackBins`, `autoPack`, `packMulti`, `repackSheetToSize`, `materialize`, `buildSheetGroups` |
| Offcuts | `offcutEmptyRects`, `offcutForSheet`, `offcutTrace`, `offcutChamfer`, `offcutUsable` |
| Takeoff + import | `parseTakeoffText`, `addTakeoffItems`, `readDxfEntities`, `loadTesseract` (OCR), `pnImportLegacy` |
| Labels + checklist | `collectPartLabels`, `cncLabelSvg`, `labelMap*`, `a4Labels*`, `buildChecklistTsv`, `qr*` |
| CAM state | `toolDb` (factory block between TOOLDB markers; pipeline `tools/xlsx2tooldb.mjs` → `tools/embed-tooldb.mjs`; t1 passDepth pinned — see comments there), `camJob` (zZero/datum/**orient: portrait machine frame**), `camPaths`, `tpDefaults` |
| CAM engine | `ringPts`, `ringWalker`, `emitLapFrom`, `emitRampThenLap`, `tpPartMoves`, `tpOrderParts`, `tpSegsForSheet`, `tpXform`/`tpDatumOff`, `ncPegasus(segs)` |
| CAM UI / tools / templates | `tpCalc`, `tpDownloadNC`, tool DB `tdb*`, per-piece machining templates `tpl*` (body 18mm vs insert 12mm, `role` filter is MANDATORY — see KABACAL_RULES) + 2.5D simulate `tplSim*` |
| Panels engine | `PN_ENGINE` block: `pnLayoutRoom`, `pnRoomRuns`, `pnRunGrid`, `pnChoose`, `PN_CAP`/`PN_CROSS` — **node-tested in check.mjs** |
| Panels UI / quote / DXF | `pnRoom`/`pnAddWall`/`pnSet*`, `pnNestRoom`, `pnQuote`, `pnWallSvg`/`pnPanoSvg`, measure tool `pnMeas*` |
| Quote + VAT | `calcQuote` (single composition point: doors + panels + services + spray + VAT), `sprayCalc`, `machOf`, `setSvc`, `toggleVat` |
| Print docs | `buildQuoteHtml`, `buildCutListHtml`, `openQuoteDoc`, `openCutList` |
| App meta | `snapshot`/`undo` (**doors-scope only** — panels/CAM edits are NOT undoable today), `validateOrder`, `genOrderNumber`, `setView`/`curMode` (modes: doors default · panels; views: order · quote · toolpaths · panels) |

## Session protocol (multi-session safety)

1. **Start:** `git pull --rebase`. If the working tree is dirty and you didn't make it dirty → **STOP** — another session is mid-work.
2. **Claim:** create `.session.lock` (gitignored) with one line: task + start time. If a lock fresher than ~3 hours exists that you didn't create → do not edit `index.html` (read-only work is fine).
3. **Work in small commits**; push after every verified change — small windows are the real conflict protection.
4. **Finish:** update `STATUS.md` if needed, delete `.session.lock`.

## How to work

- **One-time per clone:** `git config core.hooksPath .githooks` — enables the pre-commit gate (`check.mjs --pre-commit`: blocks index.html commits without a ROADMAP entry; warns on guarded-zone edits without staged goldens). Works for every model and human.
- **Validate:** `node tools/check.mjs` — compiles the inline script + production invariants (pricing, DXF layers, NC post) + executes the Panels engine behavioural tests. Run after every `index.html` edit.
- **Run the app:** `python -m http.server 8123` in the repo root → http://127.0.0.1:8123/ (Claude Code: preview config `kabacal`).
- **Verify runtime:** full model-neutral procedure in `docs/TESTING.md` (invariants table, quote baskets, golden self-check trick); seeding recipes in `tests/golden/README.md`.
- **Goldens:** `tests/golden/` holds byte-exact NC / DXF / quote-JSON outputs for three fixed jobs (standard, rich doors, panels). If your change alters any of them **intentionally**, itemise the diff and regenerate in the same commit. Unintended diff = your change is wrong.
- **Examples:** `examples/*.fastcnc.json` are the same jobs as loadable files — use them for manual tests and the save/load round-trip check (`docs/TESTING.md`).
- **Deploy:** push to `main` (Pages serves it within ~1 min). CI (`.github/workflows/check.yml`) runs the checker post-push.

## Reading order by task

- **Pricing** → this file's guarded table + `KABACAL_RULES.md` (panels pricing) — `docs/PRICING.md` planned
- **Nesting / offcuts / DXF** → `KABACAL_RULES.md` + `.claude/agents/dxf-nesting-reviewer.md`
- **CAM / NC / templates** → `KABACAL_RULES.md` (flushback + template rules, binary-order reversal) + `.claude/agents/cam-reviewer.md` (machine contract)
- **Panels** → `KABACAL_RULES.md` §Panels + the PN tests inside `tools/check.mjs`
- **History / what shipped** → `ROADMAP.md` — read the **top 2 entries only** (it's 74KB of history)

Claude Code sessions get extra conveniences via `CLAUDE.md` (skills, subagents). Everything load-bearing lives here and in the linked files — no hidden memory.
