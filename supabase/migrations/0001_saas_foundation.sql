-- Kabacal SaaS foundation — accounts, membership, jobs, account settings.
-- DRAFT until first applied to a project (no Supabase project exists yet — docs/SAAS.md Phase 1).
-- Apply via Supabase CLI (`supabase db reset` locally, `supabase db push` hosted)
-- or paste into the dashboard SQL editor. Idempotence: this file assumes a fresh project.
--
-- Design notes (full rationale in docs/SAAS.md):
--   * Deny-by-default: RLS on everything, anon revoked entirely, policies for `authenticated` only.
--   * plan/status are billing-owned: clients may only update accounts.name (column grants).
--   * account_members has NO client write policies during beta (dashboard/service-role only).
--   * jobs.job_json is the exact .fastcnc payload (buildFastCnc) — never reshaped server-side.
--   * account_settings.settings is ONE jsonb mirroring the business kab_* keys (tolerant reader,
--     additive fields forever — same convention as .fastcnc).

-- ---------------------------------------------------------------- tables

create table public.accounts (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 1 and 120),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  plan          text not null default 'beta'   check (plan   in ('beta','starter','workshop','pro')),
  status        text not null default 'active' check (status in ('active','suspended','cancelled')),
  created_at    timestamptz not null default now()
);
comment on table public.accounts is 'One workshop/company. plan+status are written by billing (dashboard now, Stripe webhook later) — never by end users.';

create table public.account_members (
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (account_id, user_id)
);
create index account_members_user_idx on public.account_members (user_id);
comment on table public.account_members is 'Membership. Owner row auto-inserted by trigger; other members managed via dashboard during beta (no client write policies yet).';

create table public.jobs (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.accounts(id) on delete cascade,
  created_by  uuid references auth.users(id) on delete set null,
  name        text not null default 'Untitled job',
  client_name text,
  status      text not null default 'draft'
              check (status in ('draft','quoted','approved','cut','done','archived')),
  job_json    jsonb not null,
  app_version text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index jobs_account_idx on public.jobs (account_id, updated_at desc);
comment on table public.jobs is 'Cloud-saved jobs. job_json = the exact .fastcnc payload; name/client_name/status are extracted at save time so lists never parse blobs. UI prefers status=archived over delete.';

create table public.account_settings (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  settings   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
comment on table public.account_settings is 'One row per account. settings mirrors the business kab_* keys additively: {ver, prices, pricecfg, custom_mats, company, tooldb, door_templates, offcut_templates, tp_templates, panels_defaults, quote_seq}.';

-- ------------------------------------------------- membership helpers
-- security definer + pinned search_path: the standard Supabase pattern so policies on
-- account_members itself never recurse, and membership checks can't be shadowed.

create or replace function public.is_account_member(acc uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.account_members m
    where m.account_id = acc and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_account_owner(acc uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.account_members m
    where m.account_id = acc and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

-- --------------------------------------------------------- triggers

-- Creating an account makes its creator the owner-member (runs as definer, so the
-- client needs no insert rights on account_members).
create or replace function public.handle_new_account()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.account_members (account_id, user_id, role)
  values (new.id, new.owner_user_id, 'owner');
  return new;
end $$;
create trigger on_account_created
  after insert on public.accounts
  for each row execute function public.handle_new_account();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger jobs_touch     before update on public.jobs             for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.account_settings for each row execute function public.touch_updated_at();

-- ------------------------------------------------------ RLS + grants

alter table public.accounts         enable row level security;
alter table public.account_members  enable row level security;
alter table public.jobs             enable row level security;
alter table public.account_settings enable row level security;

-- anon (logged-out) can touch nothing at all.
revoke all on public.accounts, public.account_members, public.jobs, public.account_settings from anon;
revoke all on public.accounts, public.account_members, public.jobs, public.account_settings from authenticated;

-- Column-level grants shape WHAT authenticated users may write; RLS below shapes WHICH ROWS.
grant select on public.accounts to authenticated;
grant insert (name, owner_user_id) on public.accounts to authenticated;  -- plan/status take defaults
grant update (name)                on public.accounts to authenticated;  -- plan/status/owner = billing/dashboard only

grant select on public.account_members to authenticated;                 -- writes: trigger + dashboard only (beta)

grant select, delete on public.jobs to authenticated;
grant insert (account_id, created_by, name, client_name, status, job_json, app_version) on public.jobs to authenticated;
grant update (name, client_name, status, job_json, app_version)          on public.jobs to authenticated;  -- account_id/created_by immutable → no cross-tenant moves

grant select on public.account_settings to authenticated;
grant insert (account_id, settings, updated_by) on public.account_settings to authenticated;
grant update (settings, updated_by)             on public.account_settings to authenticated;

-- accounts
create policy accounts_select on public.accounts for select to authenticated
  using (public.is_account_member(id));
create policy accounts_insert on public.accounts for insert to authenticated
  with check (owner_user_id = (select auth.uid()));
create policy accounts_update on public.accounts for update to authenticated
  using (public.is_account_owner(id))
  with check (public.is_account_owner(id));
-- no delete policy: accounts are never client-deleted during beta.

-- account_members (read-only to clients; see trigger + dashboard)
create policy members_select on public.account_members for select to authenticated
  using (public.is_account_member(account_id));

-- jobs
create policy jobs_select on public.jobs for select to authenticated
  using (public.is_account_member(account_id));
create policy jobs_insert on public.jobs for insert to authenticated
  with check (public.is_account_member(account_id) and created_by = (select auth.uid()));
create policy jobs_update on public.jobs for update to authenticated
  using (public.is_account_member(account_id))
  with check (public.is_account_member(account_id));
create policy jobs_delete on public.jobs for delete to authenticated
  using (public.is_account_member(account_id));

-- account_settings
create policy settings_select on public.account_settings for select to authenticated
  using (public.is_account_member(account_id));
create policy settings_insert on public.account_settings for insert to authenticated
  with check (public.is_account_member(account_id) and updated_by = (select auth.uid()));
create policy settings_update on public.account_settings for update to authenticated
  using (public.is_account_member(account_id))
  with check (public.is_account_member(account_id) and updated_by = (select auth.uid()));
-- no delete policy: settings rows live and die with the account (cascade).

-- ------------------------------------------------------------- notes
-- * Signups must be DISABLED in Auth settings during beta (dashboard, not SQL) — invite-only.
-- * Stripe tables (billing_customers, billing_subscriptions) arrive in a later migration
--   once Phase 4 starts — see docs/SAAS.md.
-- * Isolation acceptance tests: supabase/README.md.
