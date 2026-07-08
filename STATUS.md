# Kabacal — STATUS (you are here)

**Update when:** a risk opens/closes, a decision is made, or in-flight work changes. Keep under ~60 lines — this is the mutable "current state", `ROADMAP.md` is the append-only history.
Last update: 2026-07-07 · repo at `e4f1b05` + Phase-1 docs commit.

## Open risks (ranked)

1. **The .NC has never cut real material.** The portrait machine frame (`tpXform`, x=1220−y) is validated on file diffs vs VCarve only. Goldens are "known state", not "known good". → Do the air-cut protocol (Z+50 air pass → scrap sheet → compare with a VCarve-cut part) **before more CAM features**, then mark goldens known-good in `tests/golden/README.md`.
2. ~~Toolpath scope staleness~~ **CLOSED 2026-07-08 (`e37cf52`)**: scoped toolpaths carry a signature of their source items (`pp.sig`); on any mismatch (delete/resize/split) `tpPathParts` cuts NOTHING and the tree shows an amber STALE badge + "Remove stale". Verified: delete under 7 template paths → 7 STALE, 0 moves emitted. `loadFastCnc` now always resets the tree before restoring the file's own paths.
3. **Pricing/business config lives in one browser profile.** `kab_prices`, `kab_custom_mats`, `kab_pricecfg`, `kab_company`, `kab_tooldb`, `kab_panels` have no automatic backup (manual Save-settings export exists). Profile reset = silent revert to book prices. → Auto-export on change, or scheduled backup.
4. **Repo and live app are PUBLIC.** The price book, £75 rule, and website formula are readable by anyone (repo + view-source on Pages). → Decision needed: private hosting vs consciously accepted risk. Write the decision here either way.
5. **Push = live, CI alarms only afterwards.** A broken push is production for ~1 minute and stays until noticed. → Switch Pages to deploy-from-Actions gated on `check.mjs`.

## In flight

- Nothing mid-work. Panels skirting/notes/import/selection shipped 2026-07-08 (ROADMAP *d*). Active sessions: claim `.session.lock`.

## Open product question (needs Ednei)

- **What does per-panel "Vertical" mean?** Shipped `panelOv.dir` (83ebf1e) flips a panel's INTERNAL shaker style (one row ↔ columns×rows grid) — it does NOT turn the panel into a physical 3000-tall vertical-sheet piece with the wall auto-refilling around it (which is what the earlier request described). A `vZones` attempt at the latter was stashed (`round4-vZones-superseded-by-83ebf1e`), not shipped. Decide which behaviour "Vertical" should mean before building more orientation.

## Decision log

- 2026-07-08 · **Per-wall skirting** added (`wall.skirt`), resolver `D.skirtFor` (panel>wall>room); per-panel prepared (`wall.panelSkirt`), no UI. Old-import skirting now maps block+per-part faithfully (305→225). Notes (`wall.notes`, `wall.panelNotes`) are inert (no geometry/price). All goldens byte-identical.
- 2026-07-08 · **3D / wall-builder = architecture review only** (no code this session). Recommendation on record in ROADMAP-adjacent report / chat: SVG top-down (2D) first feeding the existing PN engine; Three.js deferred. See the review before starting.
- 2026-07-07 · **Doors is the default mode** on boot (`kab_mode` no longer restored). Panels stays one click away.
- 2026-07-07 · **Edging pricing deferred** (user's call) until pricing consolidation.
- 2026-07-07 · Panels shipped (engine + quote + DXF). **Panels CAM/offcuts = Phase 2**, not started.
- 2026-07-06 · **Do NOT split `index.html` into modules** until a trigger fires: 2+ genuine parallel writers, file ≳600KB, or the pricing-DB build-out. When it fires: extract the CAM engine first, classic `<script src>` (no build), one zero-behaviour commit per seam, goldens byte-stable throughout.
- 2026-07-01 · The **Website pricing formula** (per door: £25 + £139/m², min £20) comes from the fastcnc.co.uk reprice study (Plain Shaker + Flat = avg JMF × cutmy). Full write-up belongs in `docs/PRICING.md` (planned).
- Standing · Single file, no build, no dependencies; additive persistence; `KABACAL_RULES.md` is the rule book; PT welcome in rules/roadmap.

## Next (recommended order)

1. **Air-cut dry run** on the Pegasus → flip goldens to known-good (highest-value single morning available).
2. **Verify + fix toolpath scope staleness** (risk 2).
3. **Auto-backup for the `kab_*` business keys** (risk 3).

## Doc system

`AGENTS.md` = entry point for every model. **Phase 2 done (2026-07-07):** `docs/TESTING.md`; goldens expanded to 13 files (rich doors DXF ×4 thicknesses, panels DXF, toolchange NC ×2, quote snapshots ×3); `examples/` (3 loadable jobs + takeoff sample, mixed one round-trip-verified); `.githooks/pre-commit` (enable per clone: `git config core.hooksPath .githooks`). Quote baskets do NOT yet cover formula mode / overrides / custom materials — extend when touching those paths. **Phase 3 done (2026-07-07):** `docs/ARCHITECTURE.md` (state registry, `.fastcnc` schema, marker blocks, split map), `docs/CONTRACT-CAM.md`, `docs/CONTRACT-DXF.md`, `docs/PRICING.md`; subagents demoted to wrappers around them; KABACAL_RULES got a TOC. The `.claude/` folder is now pure convenience — deleting it loses no knowledge. **Phase 4 done (2026-07-07):** NEST/OFFCUT/CAM engine marker blocks with executed node tests in `check.mjs` (the PN pattern); engines are split-ready.
