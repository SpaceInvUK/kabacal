# DXF export contract

**Update when:** a layer is added or its meaning changes (renaming/removing existing layers is FORBIDDEN — they are an interface with the VCarve gadgets). `.claude/agents/dxf-nesting-reviewer.md` wraps this file.

## Consumers

The exported DXFs feed the **VCarve gadgets** (in the `CNC App` repo: "Fast CNC DXF to Sheet by Layer", "Apply Toolpath To All Sheets", "Save All Sheets Toolpaths") — each layer name maps to a toolpath recipe on the VCarve side. A wrong/renamed layer silently machines wrong. After any writer change, at least one manual round-trip through the real gadget is required before production use (`docs/TESTING.md`).

## Files

- **Doors** (`buildDxfByThickness` → `dxfForThickness`): **one file per thickness** — `ORDER_<th>.dxf`. Back-face parts appear as extra mirrored sheets (`mirrorBackPart`); with `backMode:'custom'` the back sheet draws the back's OWN offset lines.
- **Panels** (`pnBuildDxfByThickness` → `pnDxfForThickness`): `PANELS_<th>.dxf`, all rooms together, same layer discipline; pieces named `«Room» Wall <n><letter>` in VISUAL order, `PART_NUMBER` follows the visual sequence (`vn`).
- Document layout: portrait, sheets stacked with a 250 gap; sheet outline + caption on `SHEET`; nesting margins/gaps (7mm) inherited from the app.

## Layer table (`DXF_LAYERS` — name: AutoCAD colour index)

| Layer | Colour | Meaning |
|---|---|---|
| `0`, `text` | 7 | defaults / free text |
| `SHEET` | 7 | sheet outline + caption ("SHEET n …") |
| `PART_NUMBER` | 7 | part number text (reserved corner) + size/name label |
| `OUT` | 150 | part outer contour (through cut) |
| `IN` / `INSIDE` | 5 | through inner cuts (trad cavity / glass opening / panels window) |
| `OFFSET_A`…`OFFSET_G` | 30/1/5/210/94/30/32 | the 7 production offset lines (A = Frame). Active line replaces the base: with NO active line the cavity itself goes out on `OFFSET_A` (Doors and Panels both) |
| `GROOVE` | 211 | groove lines |
| `LED_CHANNEL` | 30 | LED channel inside a groove |
| `REEDED` | 132 | reeded insert pattern |
| `BEADING` | 34 | glass beading strips |
| `SCRIBE` | 230 | scribe line |
| `hinges` | 7 | hinge drill circles |
| `OUT_10MM` | 105 | flushback ring (reference op not in current templates) |
| `IN_22MM` | 5 | flushback insert-recess contour ("on"/inside ops) |
| `POKET_INSERT` | 30 | flushback insert-recess pocket band |
| `SHADOW` | 105 | flushback 2mm shadow ring |
| `OFFCUT` | 6 | offcut outline (OPEN polyline — sheet-edge sides omitted) + 3mm 45° identification chamfer ON the drawn line |
| `OFFCUT_TEXT` | 4 | the word OFFCUT + size (L-shape: both maximal sizes with `/`) — ALWAYS separate from the geometry layer |

Geometry conventions: rounded corners r2.5 on offset/cavity lines; text auto-fitted (`fitDxfPartText`); duplicated same-geometry rings on different layers are **intentional** (each layer feeds a different VCarve op — flushback reference behaviour).

Business rules for offcut shape/thresholds, flushback ring distances, insert sizing: `KABACAL_RULES.md` (that file wins on any disagreement about WHAT to draw; this file defines WHERE it lands).

## Evidence

Golden DXFs must diff clean or be itemised + regenerated in the same commit: `GOLDEN_18mm.dxf` (plain), `GOLDEN_RICH_{18,12,9,3}mm.dxf` (all machining layers), `GOLDEN_PANELS_18mm.dxf`. Recipes: `tests/golden/README.md`.
