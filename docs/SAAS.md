# Kabacal — SaaS foundation (staged plan)

**Update when:** a phase ships, a decision below is made, or the data model / RLS / secrets policy changes. This is the canonical cloud doc — the migration in `supabase/migrations/` implements it.
Status: **Phase 0 shipped** (docs + schema draft + feature flag). Nothing is live; no Supabase project exists yet.

## Verdict (read this first)

Kabacal stays **local-first forever**. The engines (quote, nesting, offcuts, DXF, CAM/NC), the `kab_*` localStorage tier and Save/Load `.fastcnc` are the product and never move server-side. "Cloud" is an **additive sync/identity layer**: login is optional, cloud save sits NEXT to file save, and with the flag off the app is byte-for-byte the current app. A user with no account keeps everything they have today.

Why Supabase: Postgres + Auth + RLS + Edge Functions in one vendor, generous free tier for a 3–5 user beta, and its security model (public anon key + database-enforced RLS) is exactly the shape a static GitHub Pages app needs — no server of our own until Stripe.

## Phases and gates

| Phase | Ships | Gate to enter |
|---|---|---|
| **0 (done)** | This doc, `supabase/migrations/0001`, env docs, `kab_cloud` flag (inert) | — |
| **1 login (LIVE dark)** | Supabase project + migration applied; optional sign-in UI (magic link); "Account" chip; signups DISABLED (invite-only) | done 2026-07-11 — D1–D4 approved, isolation tests passed |
| **2 cloud jobs (LIVE dark)** | ☁ modal: Save to cloud / Update / Save-as-new / Open from cloud / Archive; `job_json` = the exact `buildFastCnc()` payload; welcome gate on boot (skippable) when enabled+signed-out | done 2026-07-11 — E2E cycle green vs hosted |
| **3 account settings (LIVE dark)** | ⇧⇩ Push/Pull of the 8 business `kab_*` keys into `account_settings.settings` (raw strings, boot readers stay the only parser); quote counter max-merge; mitigates STATUS risk #3 once pushed | done 2026-07-11 — E2E vs hosted green |
| **4 Stripe** | Checkout + customer portal + webhook → `accounts.plan/status`; plan gating | Beta feedback says people would pay; D5 (pricing) decided |
| **5 public** | Self-serve signup ON, landing page, marketing | Isolation re-audit; support/backup story |

Rollback at every phase = flag off (app is 100% local again). Phases are additive — no phase rewrites an earlier one.

## What stays local vs what becomes cloud

| Data | Today | End state |
|---|---|---|
| Engines (quote/nest/offcut/DXF/CAM) | in-page JS | **stays in-page** — offline selling point, and moving it server-side would kill the workshop-floor use case |
| Current job being edited | in-page state | stays in-page |
| `.fastcnc` files | user's disk | stays; cloud jobs store the **same payload** in `jobs.job_json` (interchange with the production calculator preserved) |
| Device prefs: `kab_theme`, `kab_mode`, `kab_favs`, `kab_mat` | localStorage | localStorage only — never sync |
| Business config: `kab_prices`, `kab_pricecfg`, `kab_custom_mats`, `kab_company`, `kab_tooldb`, `kab_door`/`kab_offcut`/`kab_tp_templates` | localStorage (one browser profile, no backup — STATUS risk #3) | localStorage **cache** + `account_settings.settings` master (Phase 3, explicit Push/Pull first, no silent sync) |
| `kab_seq` quote counter | per-browser (collision risk) | account-level sequence (Phase 3) |
| Saved jobs library | files on disk | disk AND `jobs` table (Phase 2) |
| Identity/plan | none | Supabase Auth + `accounts` (Phase 1/4) |

## Topology

```
GitHub Pages (static index.html, public)
   │  supabase-js (Phase 1+; loaded lazily ONLY when cloudEnabled())
   ▼
Supabase project
   ├─ Auth (magic link; signups disabled during beta)
   ├─ Postgres + RLS  ← the ONLY tenant boundary
   └─ Edge Functions (Phase 4 only: stripe-webhook, create-checkout-session, create-portal-session)
         ▲ holds ALL secrets (service role, Stripe keys)
Stripe (Phase 4)
```

GitHub Pages cannot hold secrets or run server code — so nothing secret can ever ship in this repo, and anything needing a secret (Stripe) lands in Edge Functions, not here. No Netlify needed unless we later want previews/redirects.

## Data model (implemented in `supabase/migrations/0001_saas_foundation.sql`)

- **`accounts`** — id, name, owner_user_id → auth.users, plan (`beta|starter|workshop|pro`, default beta), status (`active|suspended|cancelled`), created_at. Plan/status are **billing-owned**: authenticated users can only update `name` (column grant); plan changes happen via dashboard now, Stripe webhook later.
- **`account_members`** — (account_id, user_id) pk, role (`owner|member`). Owner row auto-created by trigger on account insert. During beta, membership is managed from the dashboard (no client insert/delete policies yet) — one less escalation surface.
- **`jobs`** — id, account_id, created_by, name, client_name, status (`draft|quoted|approved|cut|done|archived`), **`job_json` jsonb = the exact `.fastcnc` payload**, app_version, created_at, updated_at. `name`/`client_name`/`status` are extracted at save time so the job list never parses blobs. Delete = members allowed, but UI should prefer status `archived`. Payloads are 50KB–1MB (camPaths-heavy) — fine for jsonb/TOAST; if they ever balloon, move blobs to Storage buckets (not now).
- **`account_settings`** — account_id pk, **`settings` jsonb** (one row per account), updated_at, updated_by. `settings` mirrors the business `kab_*` keys additively: `{ver, prices, pricecfg, custom_mats, company, tooldb, door_templates, offcut_templates, tp_templates, panels_defaults, quote_seq}` — same tolerant-reader convention as `.fastcnc` (accept old shapes forever). One jsonb beats per-column (`materials`, `sheet_prices`, …) because the app's settings are already versioned JSON blobs and per-column would force a migration every time a setting is born — the jsonb IS the schema the app already has.

Users = `auth.users` (Supabase-managed). No profile table until something needs one.

## RLS / security plan

Deny-by-default: RLS enabled on all four tables, **anon role revoked entirely** (logged-out users can read nothing), policies only for `authenticated`.

| Table | select | insert | update | delete |
|---|---|---|---|---|
| accounts | member | self as owner (cols: name, owner_user_id) | owner, **name column only** | nobody (beta) |
| account_members | member of that account | nobody (trigger + dashboard) | nobody | nobody |
| jobs | member | member ∧ `created_by = auth.uid()` | member (cols exclude account_id/created_by — no cross-tenant moves) | member |
| account_settings | member | member ∧ `updated_by = auth.uid()` | member ∧ same | nobody |

Membership checks go through `is_account_member(acc)` / `is_account_owner(acc)` — `security definer` functions with pinned empty `search_path`, which is the standard Supabase pattern to keep `account_members` policies non-recursive. `(select auth.uid())` form everywhere (per-statement caching).

**Isolation acceptance test (must pass before any real beta user):** two test users A/B in different accounts; as B, attempt to select/insert/update/delete A's account, jobs, settings and members via the REST API with B's JWT — every attempt must return zero rows / permission error. Scripted in `supabase/README.md`.

## Secrets policy

| Thing | Where it may live |
|---|---|
| Supabase URL + **anon** key | index.html / repo — public **by design**, safe ONLY because RLS is the gate and signups are disabled during beta |
| Supabase **service role** key | NEVER in this repo, never client-side. Dashboard + Edge Function secrets only |
| Stripe secret + webhook secret | Edge Function secrets only (Phase 4) |
| Admin/invite tooling | Supabase dashboard (beta); never in-app |
| Tenant pricing/settings | `account_settings` rows under RLS — never in repo code |

## Sensitive-config report (what the public app exposes TODAY)

Anyone can read, via this public repo or view-source on the live page:

1. Full **`PRICES` book** (£/sheet per material+thickness) and **`cncForThickness`** bands — index.html ≈ line 1400.
2. The **£75** MDF-18-on-10x4 special (also pinned by `check.mjs`).
3. **Website formula** £25 + £139/m² min £20, with provenance comments naming the 2026-07-01 reprice study.
4. **Labour rates** 35/25/50/250 £/h and £330/sheet Panels CNC — in `calcQuote`/docs.
5. Machining uplift model (pocket/reed minutes, drilling +5%, extra +10%) and spray model.
6. **Tool DB**: 116 real FASTCNCTOOLS feeds/speeds (TOOLDB block) — moderate competitive sensitivity.
7. Company identity/logo — already public on fastcnc.co.uk, harmless.

Assessment:
- **Safe to keep in front-end:** all engine logic and UI defaults. The formula mirrors the public website's own pricing; rates are quoted to customers anyway. This is "someone could learn our price list", not credential exposure.
- **Moves to DB at Phase 3:** each workshop's REAL numbers (price overrides, custom materials, rates, company details, tool DB) become tenant rows under RLS. FAST CNC becomes tenant #1; the repo's embedded book then degrades to demo defaults.
- **Decision open (= STATUS risk #4):** whether to genericise the embedded FAST CNC numbers after Phase 3. NOT done casually — £75 and the book are pinned by `check.mjs` + quote goldens; changing them is a guarded pricing change needing its own approved commit.
- **Never in front-end:** service role key, Stripe secrets, admin configs, other tenants' anything.

## Feature flag (shipped, Phase 0)

Top of the inline script: `CLOUD_PHASE` const (**0** today) + `cloudCfg()`/`cloudEnabled()` reading the new localStorage key **`kab_cloud`** (JSON: `{enabled, url, anonKey}`). Double-gated: `cloudEnabled()` requires `CLOUD_PHASE >= 1` (code shipped) AND `kab_cloud.enabled === true` (device opt-in) — so today the flag is inert by construction, and later a beta device can be switched on without a deploy. supabase-js loads lazily only when enabled (same pattern as Tesseract) — zero payload for local users.

## Developing without going online (Phase 1/2 workflow)

1. **Now (Phase 0):** nothing online. ✔
2. **Mock first:** implement cloud save/open against a `cloudStore` interface backed by localStorage; flip to Supabase after UI settles. Cheap insurance, recommended for Phase 2 UI work.
3. **Supabase CLI local stack** (`supabase init/start`, Docker): full Postgres+Auth on localhost; `supabase db reset` replays `supabase/migrations/`. Recommended from Phase 1 — RLS gets tested locally before any real data exists.
4. **Hosted project last:** apply the same migration; flag on for dev devices only.

## Stripe (Phase 4 — prepared, not built)

- New tables (later migration): `billing_customers` (account_id pk, stripe_customer_id unique) · `billing_subscriptions` (id = Stripe sub id, account_id, price_id, status, current_period_end, cancel_at_period_end, raw jsonb). Client access: read-only via RLS; writes ONLY from the webhook (service role).
- Edge Functions: `create-checkout-session` (auth'd member → Checkout URL), `create-portal-session`, `stripe-webhook` (signature-verified; handles `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed` → grace period). Webhook is the single writer of `accounts.plan/status`.
- Plans: Beta (free, invited) · Starter · Workshop · Pro. Limits (jobs count, members) enforced where cheap in UI, where real in RLS/Edge — never front-end-only.
- Beta accounts keep `plan='beta'` and simply bypass billing until launch.

## Private beta (3–5 shops)

- **Access:** signups disabled; Ednei invites by email from the dashboard (magic link). Each shop = one account, `plan='beta'`. Admin = the Supabase dashboard (no in-app admin during beta).
- **Onboarding:** 30-min call; load one of `examples/*.fastcnc.json`; then a real job: quote → nest → PDF → DXF (→ VCarve). Their prices via Price Settings (device-local until Phase 3).
- **Feedback:** "Report a problem" mailto chip when logged in (subject pre-filled with app version + account) — joiners won't use GitHub issues.
- **Exit criteria before ANY public marketing:** isolation tests green · 1 real cut job per shop · zero cross-tenant incidents · restore-from-cloud drill done · backup story decided (free tier has no PITR — export schedule or paid plan).
- Cheap by design: 5 users sit comfortably in Supabase free tier.

## Landing page (note only — not now)

Positioning: **“Kabacal helps CNC workshops quote, plan and export MDF doors and wall panels faster.”** Scope words: quoting + doors + wall panels + nesting + PDF + DXF for VCarve workflow. Do NOT position as a CAM replacement (the .NC path hasn't cut real material yet — STATUS risk #1). One static page, same repo or subdomain, after Phase 2.

## Decisions (D1–D4 answered by Ednei 2026-07-11)

- **D1 auth method: magic-link only** for beta. Explicitly changeable later — adding email+password is additive in Supabase (enable the provider + a "set password" flow; same `auth.users`, no migration). Session persists per device (supabase-js refresh tokens), so users receive a link/code roughly **once per device/browser**, not per visit — the Notion/Slack pattern.
- **D2 embedded FAST CNC numbers: keep for now.** Revisit after Phase 3 moves the real config into `account_settings` (genericising = guarded pricing change, own approved commit).
- **D3 Phase 3 sync scope: all business keys** — prices, pricecfg, custom_mats, company, tooldb, DXF/machining templates, quote counter. Device-only forever: theme, mode, favs, colours.
- **D4 repo visibility: stays public**; tenant data private via RLS.
- **D5 (Phase 4):** plan prices/limits — still open, decide when Phase 4 starts.

## Phase 1 status (LIVE dark since 2026-07-11)

Complete and verified end-to-end, still invisible by default. Hosted project `rvmyalrtoblxmxciiovd` (created by Ednei, configured 2026-07-11): migration applied, signups disabled, Site URL + dev redirects set, **all 9 isolation tests + sanity passed against the hosted DB** (`tools/saas-isolation-test.mjs` with pre-created dashboard test users — no service key ever left the dashboard). App side: `CLOUD_DEFAULTS` (URL + publishable key, public by design) inlined so a device only needs `kab_cloud={"enabled":true}` — or simply opening **`?cloud=on`** (`?cloud=off` disables; URL can toggle ONLY the enabled bit, never url/anonKey — anti-phishing); full E2E done in-app (real sign-in → account chip "Iso Shop A"/beta/owner via RLS → sign-out; OTP for a stranger correctly refused "Signups not allowed"). Flag-off re-verified byte-identical after inlining.

**Known limit (blocks invites, not Ednei):** the built-in mailer sends only to org members and locks templates → magic-link e-mail is link-only today. **Custom SMTP (Resend free / fastcnc mailbox) is the one prerequisite before inviting beta shops**; it also enables the `{{ .Token }}` code the modal already accepts.

## Phase 3 status (LIVE dark since 2026-07-11)

Workshop settings Push/Pull in the ☁ modal (account stage), explicit with in-modal confirms — never silent. `CLOUD_SYNC_KEYS` = `kab_prices, kab_pricecfg, kab_custom_mats, kab_company, kab_tooldb, kab_doorTpl, kab_offcutTpl, kab_tp_templates`; the **raw localStorage strings** travel inside `account_settings.settings.keys` so the boot-time tolerant readers remain the only parser (cloud copies inherit load-forever). Device-only forever: theme, mode, favs, colours, camjob/campaths. **Pull** = write keys → `kab_seq` **max-merge** (never backwards) → `location.reload()`, carrying the on-screen job (and its `cloudJob` link) across via sessionStorage stash, with a confirmation message after boot. Missing key in the cloud copy removes the local key (true mirror). Quote counter: max-merge ships now; an atomic server-side `next_quote_seq` RPC is deferred until an account has a second member. Pushing regularly = the durable backup for STATUS risk #3.

## Phase 2 status (LIVE dark since 2026-07-11)

Cloud jobs shipped inside the ☁ modal, all behind the same opt-in: **Save to cloud** (insert) / **Update this cloud job** / **Save as a new cloud job** (the app tracks `cloudJob` = the cloud row loaded in this tab; sign-out clears it) / **Open from cloud…** (list of non-archived jobs, newest first, click to load) / per-row **Archive** (soft delete — real DELETE stays member-allowed but the UI never offers it). `job_json` is the exact `buildFastCnc()` payload and opening goes through `loadFastCnc` — the same tolerant reader as files, so cloud rows inherit the load-forever rule. **Welcome gate**: when cloud is enabled and nobody is signed in, the sign-in modal fronts the app on boot (once per tab session, "Continue without account" skips) — Ednei's "page before the app", without breaking local-first. E2E vs hosted: save → modify → update (same row) → wipe → open (items/client/quote restored) → save-as-new (new row) → archive (gone from list); found+fixed a stuck-busy bug in `cloudOpenJob` during E2E. Local Save/Load JSON untouched and remains the offline path.
