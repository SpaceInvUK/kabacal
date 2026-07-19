# Kabacal — Supabase (cloud tier)

**Status: LIVE (dark) since 2026-07-11.** Hosted project `rvmyalrtoblxmxciiovd` (org "Kabacal LTD", AWS eu-central-1), URL `https://rvmyalrtoblxmxciiovd.supabase.co`. Migration 0001 applied; signups DISABLED (invite-only); Site URL = the Pages app + localhost:8123/8125 redirects; isolation tests **passed against this project** 2026-07-11. The app embeds the URL + **publishable** key as defaults (public by design — RLS is the gate); a device still shows zero cloud UI until it opts in — open **`https://spaceinvuk.github.io/kabacal/?cloud=on`** (or set `kab_cloud={"enabled":true}`); `?cloud=off` reverts. The URL param can only flip the enabled bit, never the backend url/key.

**Built-in mailer restrictions (matters before ANY beta invite):** the default email service only delivers to the project org's member addresses and cannot edit templates — so today the magic-link e-mail is the stock link-only template and reaches Ednei's own address only. **Before inviting outside users: configure custom SMTP** (Resend free tier or the fastcnc mailbox) — that unlocks delivery to anyone AND the `{{ .Token }}` 6-digit-code template the app's code input already supports.

**Test fixtures:** users `iso-a@kabacal.test` / `iso-b@kabacal.test` (+ their "Iso Shop A/B" accounts, jobs, settings) are disposable rows created by the isolation tests — safe to delete from the dashboard any time; re-running the script recreates its own.

## Applying the schema

Local first (recommended — needs Docker Desktop **fully set up**: its first-run wizard/licence must have been completed once by a human; observed 2026-07-11 that a fresh install with no WSL distro blocks `supabase start` with engine 500s):

```bash
npx supabase init          # once, from repo root (creates supabase/config.toml)
npx supabase start         # local Postgres + Auth + Studio on localhost
npx supabase db reset      # replays supabase/migrations/ from scratch
```

Hosted project (Phase 1, after local tests pass):

```bash
npx supabase link --project-ref <ref>
npx supabase db push       # applies pending migrations
```

(Or paste `migrations/0001_saas_foundation.sql` into the dashboard SQL editor — fine for a one-off, but the CLI keeps local and hosted in lockstep.)

## Environment variables

Copy `.env.example` to `.env` (**gitignored — never commit `.env`**). Only the URL + anon key are ever client-visible; they are public **by design** and safe only because RLS is the gate. The service role key and (later) Stripe secrets live exclusively in the dashboard / Edge Function secrets.

## Beta project checklist (Phase 1, hosted)

1. Create project (EU region — UK users).
2. **Authentication → disable "Allow new users to sign up"** — beta is invite-only.
3. Auth → Email: magic link (OTP) enabled; SMTP defaults are fine for 5 users.
4. Apply migration (above).
5. Invite beta users by email from the dashboard.
6. Create each shop's account row + membership from the dashboard (or let the Phase-1 UI's "Create your workshop" do it on first login).
7. Run the isolation tests below. **No real user data before they pass.**

## Phase 4 — TEST-mode state (2026-07-11) + the 4 secrets Ednei pastes

**Done via the dashboard/sandbox (agent, 2026-07-11):** Stripe account created by Ednei (sandbox `acct_1Ts5DyJw3B6LYHCv`, business activation deliberately SKIPPED — only needed for live money). 3 recurring GBP products created with **placeholder test amounts** (real prices = D5, changeable any time): Kabacal Starter £15/m `price_1Ts5JOJw3B6LYHCvwvQk10OC` · Workshop £29/m `price_1Ts5KXJw3B6LYHCvpAatHUPA` · Pro £59/m `price_1Ts5L6Jw3B6LYHCvrfNPZnhQ`. Webhook destination `kabacal-webhook` (`we_1Ts5TUJw3B6LYHCvgSrXSNXt`) → `https://rvmyalrtoblxmxciiovd.supabase.co/functions/v1/stripe-webhook`, 5 events, signing secret never revealed to the agent. All 3 Edge Functions **deployed** via dashboard editor (`stripe-webhook` with JWT verification OFF; the other two ON).

**Remaining — Ednei pastes 4 secrets** (Supabase → Edge Functions → Secrets; the secret-store is human-only by policy):

| Name | Value / where to get it |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys → reveal the **test** secret key (`sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe → the `kabacal-webhook` destination page → Signing secret → Reveal (`whsec_…`) |
| `STRIPE_PRICES` | `{"price_1Ts5JOJw3B6LYHCvwvQk10OC":"starter","price_1Ts5KXJw3B6LYHCvpAatHUPA":"workshop","price_1Ts5L6Jw3B6LYHCvrfNPZnhQ":"pro"}` |
| `APP_URL` | `https://spaceinvuk.github.io/kabacal/` |

**Then hand back to the agent:** wire the Upgrade buttons in the ☁ modal + full E2E with test card `4242 4242 4242 4242` (checkout → webhook → plan flips → portal cancel → plan reverts). Live mode only after beta demand + D5 + Stripe business activation (bank/KYC — always Ednei's own steps).

## Isolation acceptance tests

Automated: **`node tools/saas-isolation-test.mjs`** — zero deps; against the local stack it self-configures from `supabase status`, against the hosted project set `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` env vars (service key creates the two throwaway users only; all checks run with user JWTs). Running it against the **hosted** project before inviting anyone is acceptable — and mandatory if the local stack isn't available.

What it proves — two users A and B, each with their own account; using **B's JWT** against the REST API:

| Attempt (as B) | Expected |
|---|---|
| `GET /rest/v1/accounts?id=eq.<A_account>` | `[]` |
| `GET /rest/v1/jobs?account_id=eq.<A_account>` | `[]` |
| `POST /rest/v1/jobs` with `account_id = <A_account>` | 403 (RLS violation) |
| `PATCH /rest/v1/jobs?id=eq.<A_job>` | 0 rows updated |
| `PATCH /rest/v1/jobs?id=eq.<B_job>` setting `account_id=<A_account>` | 400/403 (column not updatable) |
| `GET /rest/v1/account_settings?account_id=eq.<A_account>` | `[]` |
| `PATCH /rest/v1/accounts?id=eq.<B_account>` setting `plan=pro` | 400/403 (column not updatable) |
| `DELETE /rest/v1/accounts?id=eq.<B_account>` | 403 (no policy) |
| Any of the above with **no** Authorization header (anon) | 401/403/`[]` |

All nine must fail closed. Re-run after ANY policy or grant change.

## order-intake (doors-online Etapa 3 — 2026-07-17)

FastCNC site bridge -> production files. Spec: cnc-calculator repo `docs/FASTCNC_DOORS_ONLINE_V1.md`.

**Pieces:** `migrations/0003_fastcnc_orders.sql` (table `fastcnc_orders`, RLS deny-all, bucket `fastcnc-orders`) + `functions/order-intake/` (**GENERATED** — `node tools/build-intake.mjs` embeds the index.html engine statically; Deno Deploy blocks `new Function`; strict-mode proven by `tools/strict-probe.mjs`; handler tested by `tools/intake-smoke.mjs`). `verify_jwt=false` (config.toml) — auth is the `X-FCNC-Secret` header.

**Deploy (CLI, needs SUPABASE_ACCESS_TOKEN):**

```bash
node tools/build-intake.mjs                     # regenerate after any index.html engine change
npx supabase functions deploy order-intake --project-ref rvmyalrtoblxmxciiovd --use-api
# migration: npx supabase db push  (or paste 0003 into the dashboard SQL editor)
```

**Secrets (dashboard -> Edge Functions -> Secrets):** `FCNC_BRIDGE_SECRET` (shared with the site wp-config) · optional `RESEND_API_KEY` + `FCNC_MAIL_FROM`/`FCNC_MAIL_TO` (default services@fastcnc.co.uk) — without the key the function stores files and skips e-mail.

**Site side (wp-config.php):** `define('FCNC_BRIDGE_URL','https://rvmyalrtoblxmxciiovd.supabase.co/functions/v1/order-intake'); define('FCNC_BRIDGE_SECRET','<same>');` — the `fastcnc-order-bridge.php` mu-plugin (cnc-calculator repo `site/mu-plugins/`) POSTs on `woocommerce_order_status_processing`, idempotent via `_fcnc_bridge_sent`.

**E2E check:** place/re-fire a paid test order -> row in `fastcnc_orders` (status `files_generated`), files under `orders/FC-{n}/` in the bucket, order note "delivered" on the Woo order.

## Online Orders tab in Kabacal (Etapas A+B — 2026-07-19)

The ☁ cloud modal (signed in) now has **"📦 Online orders (site)…"**: lists `fastcnc_orders`
newest-first with status + per-file downloads (signed URLs, 5 min) and **"Open in Kabacal"**
on the `.fastcnc` file (transactional load — a rejected file leaves the app untouched).
This replaces the email → download → pendrive loop for inspection.

**One-time setup (dashboard → SQL editor):**

1. Run `migrations/0004_orders_read.sql` — creates the `app_admins` allowlist (RLS deny-all,
   service_role is the only writer) + SELECT policies on `fastcnc_orders` and the
   `fastcnc-orders` bucket for enrolled admins only. The iso-a/iso-b isolation fixtures are
   NOT admins, so the 13-check isolation suite stays green.
2. Enrol yourself:
   `select id, email from auth.users;` → copy your uid →
   `insert into public.app_admins (user_id, note) values ('<uid>', 'Ednei — owner') on conflict do nothing;`

**Check:** app with cloud on → sign in → ☁ → Online orders → FC-4004 listed with its 3 files;
"Open in Kabacal" loads the job. Without the migration/enrolment the tab shows the exact
error + a pointer to this runbook (nothing breaks).
