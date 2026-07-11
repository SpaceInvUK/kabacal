-- Kabacal SaaS — Phase 4 billing foundation (Stripe arrives later; tables first).
-- Applied to hosted project 2026-07-11 (empty, additive, RLS'd).
--
-- Writer model: the stripe-webhook Edge Function (service role) is the ONLY writer
-- of these tables and of accounts.plan/status. Clients get read-only visibility of
-- their own account's billing state — no insert/update/delete grants at all.

create table public.billing_customers (
  account_id         uuid primary key references public.accounts(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at         timestamptz not null default now()
);
comment on table public.billing_customers is 'account ↔ Stripe customer mapping. Written only by Edge Functions (service role).';

create table public.billing_subscriptions (
  id                   text primary key,   -- Stripe subscription id (sub_…)
  account_id           uuid not null references public.accounts(id) on delete cascade,
  status               text not null,      -- Stripe status: trialing|active|past_due|canceled|unpaid|…
  price_id             text,
  plan                 text,               -- resolved slug: starter|workshop|pro
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  raw                  jsonb,              -- last Stripe subscription object, for audit/debug
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index billing_subscriptions_account_idx on public.billing_subscriptions (account_id);
comment on table public.billing_subscriptions is 'Mirror of Stripe subscriptions. Written only by the stripe-webhook Edge Function; accounts.plan/status are derived from here by the same webhook.';

create trigger billing_subscriptions_touch before update on public.billing_subscriptions
  for each row execute function public.touch_updated_at();

alter table public.billing_customers     enable row level security;
alter table public.billing_subscriptions enable row level security;

revoke all on public.billing_customers, public.billing_subscriptions from anon;
revoke all on public.billing_customers, public.billing_subscriptions from authenticated;
grant select on public.billing_customers, public.billing_subscriptions to authenticated;

create policy billing_customers_select on public.billing_customers for select to authenticated
  using (public.is_account_member(account_id));
create policy billing_subscriptions_select on public.billing_subscriptions for select to authenticated
  using (public.is_account_member(account_id));
-- no write policies on purpose: service role bypasses RLS, clients never write billing.
