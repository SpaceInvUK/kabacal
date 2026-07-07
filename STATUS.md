# Kabacal — STATUS (you are here)

**Update when:** a risk opens/closes, a decision is made, or in-flight work changes. Keep under ~60 lines — this is the mutable "current state", `ROADMAP.md` is the append-only history.
Last update: 2026-07-07 · repo at `e4f1b05` + Phase-1 docs commit.

## Open risks (ranked)

1. **The .NC has never cut real material.** The portrait machine frame (`tpXform`, x=1220−y) is validated on file diffs vs VCarve only. Goldens are "known state", not "known good". → Do the air-cut protocol (Z+50 air pass → scrap sheet → compare with a VCarve-cut part) **before more CAM features**, then mark goldens known-good in `tests/golden/README.md`.
2. **Toolpath scope staleness — needs verification.** Toolpath `scope`/selection snapshots reference positional part keys; deleting/splitting items *after* Calculate may silently retarget which parts are cut. The `role` filter fixed one collision class (see KABACAL_RULES, templates v2); the delete/split path is unverified. → 5-min repro: scoped path → delete item 0 → inspect NC.
3. **Pricing/business config lives in one browser profile.** `kab_prices`, `kab_custom_mats`, `kab_pricecfg`, `kab_company`, `kab_tooldb`, `kab_panels` have no automatic backup (manual Save-settings export exists). Profile reset = silent revert to book prices. → Auto-export on change, or scheduled backup.
4. **Repo and live app are PUBLIC.** The price book, £75 rule, and website formula are readable by anyone (repo + view-source on Pages). → Decision needed: private hosting vs consciously accepted risk. Write the decision here either way.
5. **Push = live, CI alarms only afterwards.** A broken push is production for ~1 minute and stays until noticed. → Switch Pages to deploy-from-Actions gated on `check.mjs`.

## In flight

- Nothing known mid-work right now. Doors-focus round (ROADMAP entry *k*) shipped at `e4f1b05`; Phase-1 model-independence docs shipped in this commit. Active sessions: claim `.session.lock` and list your task here if it spans sessions.

## Decision log

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

`AGENTS.md` = entry point for every model. Planned (Phases 2–3 of the model-independence plan): `docs/TESTING.md`, `docs/ARCHITECTURE.md`, `docs/CONTRACT-CAM.md`, `docs/CONTRACT-DXF.md`, `docs/PRICING.md`; golden expansion (rich doors DXF, panels DXF, 2-tool NC, quote snapshots); `examples/*.fastcnc.json`; `.githooks/pre-commit`.
