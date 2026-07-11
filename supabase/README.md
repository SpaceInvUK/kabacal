# Kabacal — Supabase (cloud tier)

**Status: DRAFT — no Supabase project exists yet.** This folder holds the schema and the runbook for when Phase 1 starts (see `docs/SAAS.md` for the plan and the phase gates). Nothing here affects the live app; the app only gains cloud behaviour when `CLOUD_PHASE ≥ 1` code ships AND a device opts in via `kab_cloud`.

## Applying the schema

Local first (recommended — needs Docker):

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

## Isolation acceptance tests

Create two users A and B (dashboard), each with their own account (rows in `accounts` via the app or SQL). Then, using **B's JWT** against the REST API (`curl -H "apikey: <anon>" -H "Authorization: Bearer <B_jwt>"`):

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
