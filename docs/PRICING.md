# Pricing — how a Kabacal quote is built

**Update when:** any rate, rule, or mechanism deliberately changes (user approval required — this is guarded zone #1). `.claude/agents/pricing-guard.md` wraps this file.

## The six mechanisms (resolution order for one number)

1. **`PRICES` book** — base £/8x4 sheet per material+thickness. Non-8x4 sizes scale by area ratio vs 8x4, rounded (`priceForSheet`).
2. **Hard-coded production specials** — MDF (or 'Standard MDF') 18mm on 10x4 = **£75 exact** (not the area formula). CNC-per-sheet bands live in `cncForThickness` (MDF family ≤12: 65 · 15: 95 · 18/22: 85 · 25/30: 120; Birch/ply ≤12: 65 · 15/18: 95 · 24: 100).
3. **`priceOverrides`** (`kab_prices`) — per-material overrides `mat:<name>` / `cnc:<name>`; always win over the book.
4. **`customMats`** (`kab_custom_mats`) — user-defined materials (name/thickness/price), valid everywhere a built-in is.
5. **Per-sheet overrides** — `sheetPriceOv['mat#idx']` (mc / cnc per physical sheet, set in the sheets view).
6. **Pricing method** (`pricingCfg`, `kab_pricecfg`) — `production` (per sheet, mechanisms 1–5) or **`website` formula**: per DOOR £25 + £139/m², min £20 — all three editable. Formula mode swaps ONLY the doors subtotal; services/spray/Panels/VAT are unaffected.
   *Provenance:* the 2026-07-01 fastcnc.co.uk reprice study — Plain Shaker + Flat = average of JMF × cutmy formulas.

## The composition (`calcQuote` — the single composition point)

```
per material group: Σ sheet material (1–5) + CNC/sheet × (1 + pocket% + reed% + drill% + extra%) + machine-time cost
                    − group discount%           ← discount applies to the group body ONLY
+ services: design/cutting/assembly hours × rates
+ spray (sprayCalc)                              ← NEVER enters any discount base
+ panels (pnQuote): per room Σ sheet material (book by real sheet size unless room override) + CNC £/sheet
= sub;  VAT = round(sub × 0.20);  total = sub + (vatOn ? VAT : 0)
```

- Machining uplifts: pocket minutes = cavity m² × 12/part (×2 if front+back); reed minutes likewise via the insert; converted by `minToPct`; drilling flat +5%; each "extra" +10%.
- **Rates** (editable in Price Settings, defaults are the production truth): design **£35/h** · cutting **£25/h** · assembly **£50/h** · machine time **£250/h** · Panels CNC service **£330/sheet**.
- Internal door panels: pocket/reed minutes sum over the per-opening cavities (identical to legacy for 1 panel).
- **Doors-only invariant:** with no panel rooms, `calcQuote().panels.total === 0` and the doors output is byte-identical to pre-Panels behaviour.

## Rules that survive ANY refactor

£75 (MDF 18 on 10x4) · spray outside every discount base · VAT 20% of sub · rates 35/25/50/250 · £330/sheet panels CNC · overrides beat book · formula mode touches only the doors subtotal · a Doors-only job never changes when Panels code changes.

## Evidence for any pricing diff

The three quote goldens must diff clean or every delta itemised + user-approved (+ regenerated): `tests/golden/QUOTE_standard.json` (£300/£60/£360), `QUOTE_rich.json` (£664/£133/£797, panels 0), `QUOTE_mixed.json` (panels £2390, £3665). **Known gap:** the baskets do not yet exercise formula mode, `priceOverrides`, or custom materials — extend the baskets in the same commit that next touches those paths (STATUS.md).
