# Kabacal — architecture

**Update when:** a state variable, `kab_*` key, `.fastcnc` field, marker block, or function family is added/renamed. Anchor by NAME (grep), never by line number — the file moves daily.

## Shape

One file, `index.html`: inline CSS + ONE inline classic `<script>` (~5,700 lines, ~600 functions). No build, no dependencies (Tesseract lazy-loads for OCR only). Pattern everywhere: **const data tables → domain engines → global `let` state → coarse render functions → inline `onclick` handlers** that mutate state and re-render. Renders are idempotent; `esc()` sanitises interpolated text.

Two **modes** (`curMode`: `doors` default · `panels`) over four **views** (`curView`: order · quote · toolpaths · panels).

## Repo family

- `cnc-calculator` repo — the production calculator; Kabacal keeps `.fastcnc` compatibility with it.
- `CNC App` repo — VCarve gadgets that consume our DXF layers (see docs/CONTRACT-DXF.md).
- `Kabacal 3D/` folder — prototype; its confirmed rules (Offset Depth pockets, `opsFor()`) were merged into KABACAL_RULES.md.

## Marker blocks (LOAD-BEARING comments)

`tools/check.mjs` and `tools/embed-tooldb.mjs` regex-extract these regions; removing/moving a marker breaks tooling:

| Markers | Contents | Node tests |
|---|---|---|
| `/*TOOLDB_START*/ … /*TOOLDB_END*/` | `TOOL_FACTORY` — embedded tool library (regenerate via `tools/xlsx2tooldb.mjs` → `tools/embed-tooldb.mjs`) | presence + t1 pin |
| `/*PN_ENGINE_START*/ … END*/` | Panels layout engine (`pnLayoutRoom` etc., pure + memoized) | executed behavioural tests in check.mjs |
| `/*NEST_ENGINE_START*/ … END*/` | MaxRects packer (`mrOverlap…packInto`) | executed tests in check.mjs |
| `/*OFFCUT_ENGINE_START*/ … END*/` | offcut detection (`ivSub…offcutForSheet`) | executed tests in check.mjs |
| `/*CAM_ENGINE_START*/ … END*/` | toolpath geometry + post (`ringPts…ncPegasus`) | executed tests in check.mjs |

**Future split map:** if/when the no-split triggers fire (STATUS.md decision log), each marker block becomes one classic `<script src>` file, extracted in dependency order (data tables → engines → UI), one zero-behaviour commit per seam, goldens byte-stable throughout. The blocks are deliberately kept global-light so extraction is mechanical.

## State registry (globals — who owns what)

| Group | Variables | Notes |
|---|---|---|
| Doors order | `items` (the model: type/w/h/q/mat/size/frame/lines A–G/pocketSide/reed/groove/hinges/spray/beading/panels/midFrame/panelSize/backMode/backLines/scribe/insOv), `orderMaterial`, `rawDoc`, `profiles` | `MULTI_FIELDS` lists every multi-editable field |
| Selection/UI | `selItem`, `selSet`, `selInst`, `inspOpen`, `fabOpen`, `marq`, `editMode`, `_zoom*`, `showBackSheets`, `curMode`, `curView`, `hideValues` | |
| Nesting | `nestSize`, `nestMargin`, `nestGap`, `customSheet`, `sheetSizeOv`, `keepPlacements`/placements, `selSheets`, `sheetPriceOv`, `nestMatCost` | `materialize()` freezes layout in edit mode |
| Pricing/meta | `project`, `priceOverrides`, `pricingCfg`, `customMats`, `companyCfg`, `services`, `machine`, `sprayAddons`, `vatOn`, `favMats`, `matColors` | see docs/PRICING.md |
| CAM | `toolDb`, `tdbGroup`, `camJob` {zZero, datum, orient, rapidGap, approach}, `camPaths`, `tpSeq`, `tpUI`, `tpFilter`, `tpForm`, `tpTemplates`, `tplSim` | see docs/CONTRACT-CAM.md |
| Panels | `panelRooms`, `pnSel`, `pnView` (wall·sheets·plan), `pnUid`, `pnLayoutMemo`, `pnVb`, `pnSnapGeo` · 2D builder: `pnPlanTool`/`pnPlanDrag`/`pnPlanSel` | engine consts `PN_CAP`/`PN_CROSS`/`PN_SHK`/`PN_WALL_T`(150)/`PN_PANEL_T`(22) |
| History | `undoStack` — `snapshot()` covers the DOORS order only (items/project/services/spray/VAT/nesting). **Panels and CAM edits are NOT undoable** (known gap) | |
| Templates (DXF) | `customDoorTemplates`, `customOffcutTemplates` | seeded factory blocks; travel inside `.fastcnc` |

## localStorage (device tier — 17 `kab_*` keys, never rename)

`kab_mat` (material colours) · `kab_favs` · `kab_tooldb` (versioned `ver:2`) · `kab_camjob` · `kab_campaths` · `kab_tp_tpl` (toolpath form presets) · `kab_tp_templates` (per-piece machining templates) · `kab_door` / `kab_offcut` (DXF template blocks) · `kab_prices` (overrides) · `kab_pricecfg` (method+formula) · `kab_custom_mats` · `kab_company` · `kab_theme` (string) · `kab_seq` (quote counter — per-browser, known collision risk) · `kab_panels` · `kab_mode`.

**Versioning convention:** `.fastcnc` has a top-level `version`; `kab_tooldb` carries `ver`. Any NEW or reshaped payload gets a version field and a tolerant reader (accept old shapes forever). Full `{v,data}` envelopes for all 17 keys were deliberately deferred — near-zero value until a migration actually needs them, high typo risk across 17 dense call sites.

## `.fastcnc` file schema (file tier — production-compatible, ADDITIVE only)

Top level: `app, fileType, version, activeCalculatorMode, customDoorTemplates, customOffcutTemplates, materialPriceOverrides, client, services, spray, savedAt, panelRooms, nextId, blocks, kabacal, kabacalQuote`.

- `blocks[]` — production material blocks (`material, thickness, size, frameSize, pocketing*, reeded*, drillings, …`) with `parts[]` inside. Kabacal-additive per-part fields: `panels, panelSize, frameMiddle, kabBackMode, kabBackLines`. `autoGenerated` blocks (inserts) are regenerated, never edited.
- `kabacal` — project meta (client/phone/email/number/date/notes).
- `kabacalQuote` — quote-side state incl. `services`, spray add-ons, VAT, per-sheet overrides, **and the CAM state: `camJob`, `camPaths`, `camTools`** (nested HERE, not top-level).
- `panelRooms` — Panels mode rooms (additive; legacy panneling quotes import via `pnImportLegacy`). A room MAY carry an additive `plan` (2D builder): `{nodes:[{id,x,y}], edges:[{id,a,b,wallThickness,height}], openings:[{id,edgeId,type,offset,width,height,bottom}], objects:[…], panelLayer:{thickness,side}}`, all mm. `pnPlanCompile(room)` (pure, in PN_ENGINE, node-tested) DERIVES `room.walls` from the plan — one wall per edge (id `pe_<edgeId>`, width=edge length, height=edge.height), preserving each wall's other settings (dir/sides/skirt/notes/panelOv/vZones/inspector-openings) by id across recompiles; plan openings/objects compile into `wall.openings` with `plan_` ids. **No `plan` → walls untouched** (manual rooms and every golden stay byte-identical). The plan is an EDITOR source; the derived `walls` remain the single input the engine/quote/DXF consume — the builder never bypasses the existing engine.

Old files must always load (`loadFastCnc` tolerant); new fields are added, never repurposed. Round-trip regression: `docs/TESTING.md`.

## Function map

The per-family anchor map lives in **AGENTS.md** (kept there so every model sees it first). Business rules: KABACAL_RULES.md. Contracts: docs/CONTRACT-CAM.md, docs/CONTRACT-DXF.md, docs/PRICING.md.
