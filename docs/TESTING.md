# Kabacal — testing (model-neutral)

**Update when:** a golden is added/renamed, a basket changes, or the pre-commit checks change.
Every procedure here works with node + git + any browser console — no Claude-specific tooling required.

## The three layers of truth

1. **`node tools/check.mjs`** — static tripwires + *executed* Panels-engine behavioural tests. Run after every `index.html` edit; must print `kabacal check ok`. Exit 2 = do not commit.
2. **Golden files** (`tests/golden/`) — byte-exact NC / DXF / quote snapshots for three fixed jobs. Regeneration recipes + expected sizes: `tests/golden/README.md`.
3. **Runtime verify in a browser** — serve, seed, assert invariants (below).

## Pre-commit hook (enforces this for every model)

One-time per clone:

```bash
git config core.hooksPath .githooks
```

Then every `git commit` runs `node tools/check.mjs --pre-commit`, which adds git-aware rules on top of the full check:

- `index.html` staged **without** `ROADMAP.md` staged → **blocks** the commit (house rule: every app change gets a dated ROADMAP entry).
- Staged `index.html` hunks that touch guarded functions (pricing / DXF / CAM / nesting names) with **no** `tests/golden/*` staged → loud **warning** (not blocking): either the output didn't change (verify with a golden diff) or it did (regenerate goldens in this commit).

## Runtime verify (browser console, no special tools)

```bash
python -m http.server 8123    # repo root
# open http://127.0.0.1:8123/  (fresh profile or localStorage.clear() + reload)
```

Seed the standard job (recipe in `tests/golden/README.md`), then assert:

| Invariant | Expression | Expect |
|---|---|---|
| Production price rule | `priceForSheet('MDF 18mm','10x4')` | `75` exactly |
| Book price | `priceForSheet('MDF 18mm','8x4')` | `55` |
| Part conservation | `calcQuote().partN` | seeded count (12 standard / 11 rich) |
| VAT | `q.vat === Math.round(q.sub*0.2)` and `q.total === q.sub + (vatOn ? q.vat : 0)` | true |
| Doors-only invariant | `calcQuote().panels.total` with no rooms | `0` |
| NC head | `nc.startsWith('%\r\n:1248\r\nG90')` | true |
| NC tail | `nc.trimEnd().endsWith('M05M30')` | true |
| No rapid into material | no `G0Z` at/below material top in NC | true |
| DXF layers | per-layer presence table in the rich recipe | see golden README |
| Console | zero errors after walking Order → Quote → Toolpaths → Panels views | clean |

**Golden self-check trick** (works entirely in-page because the server serves the repo):

```js
const g = await fetch('/tests/golden/GOLDEN_S1_18mm_datum-ll.nc').then(r=>r.text());
ncLL === g   // true = current code still produces the committed golden, byte-exact
```

## Quote baskets (pricing evidence)

- **Basket A / standard** — 12 plain parts → `QUOTE_standard.json` (£300 sub / £60 VAT / £360). No services, no spray.
- **Basket rich** — flush + trad(2 panels) + reeded + backside-custom + glass/beading + services 1/0.5/1h + spray → `QUOTE_rich.json` (£664/£133/£797, `panels.total` 0).
- **Basket mixed** — rich + 2 panels rooms → `QUOTE_mixed.json` (panels £2390, total £3665).

Any pricing-zone change: regenerate all three quote JSONs and diff. A delta not explicitly requested by the user = the change is wrong. Note the baskets do NOT yet cover: Website-formula mode, `priceOverrides`, custom materials — extend the baskets when touching those paths (see STATUS.md).

## Example jobs (`examples/`)

Loadable `.fastcnc.json` files of the same three jobs (+ `sample-takeoff.txt`). Uses:
- Manual testing: File → Open in the app.
- **Save/load regression**: cold-load `rich-doors-and-panels.fastcnc.json` and compare `calcQuote()` with `tests/golden/QUOTE_mixed.json` — this exact round-trip was verified at capture time (2026-07-07). Any future `loadFastCnc`/`buildFastCnc` change must repeat it.

## VCarve gadget round-trip (manual, user-run)

The DXF layer names are a contract with the VCarve gadgets. After any DXF-writer change, at least once before relying on it in production: export a rich-job DXF and a PANELS DXF, run them through the real "DXF to Sheet by Layer" gadget on the VCarve machine, and confirm each layer lands on the intended toolpath. Not automatable from this repo — schedule it with machine time (see STATUS.md risks: same session as the air-cut is ideal).

## Evidence required per guarded zone (summary)

| Zone | Minimum evidence before commit |
|---|---|
| Pricing | 3 quote-JSON diffs clean (or itemised + approved) |
| DXF | `GOLDEN_*.dxf` diffs clean (or itemised + regenerated) |
| CAM/NC | `GOLDEN_S1*/GOLDEN_TPL*` diffs clean (or itemised + regenerated); air-cut still pending overall |
| Nesting/offcuts | `check.mjs` PN tests green + part-count conservation + golden DXF diffs |
| Save/load | round-trip: load `examples/rich-doors-and-panels.fastcnc.json` → quote equals `QUOTE_mixed.json` |
