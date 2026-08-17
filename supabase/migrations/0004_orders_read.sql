-- 0004: Online Orders tab in Kabacal — ADMIN read access to the site's landed orders.
-- Model: app_admins = explicit allowlist. Deny-by-default like 0001/0003: RLS on, NO client
-- policies on app_admins itself (only service_role manages the list). Users on the list can
-- SELECT fastcnc_orders and READ the private 'fastcnc-orders' bucket. The isolation fixtures
-- (iso-a / iso-b) are NOT admins, so the 13-check isolation suite stays green.
--
-- APPLY: Supabase dashboard → SQL editor → run this file once.
-- ENROL YOURSELF (once, same editor):
--   select id, email from auth.users;                     -- find your uid
--   insert into public.app_admins (user_id, note)
--   values ('<your-uid>', 'Ednei — owner')
--   on conflict do nothing;

create table if not exists public.app_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;
-- no policies on purpose: anon/authenticated cannot read or edit the admin list;
-- service_role bypasses RLS and is the only writer.

-- Belt-and-braces grants (docs/SAAS.md: anon revoked ENTIRELY). 0003 relied on RLS alone
-- and left the default table grants in place (anon probes got 200 [] instead of 401);
-- fixed here since this migration touches the same table. authenticated keeps SELECT on
-- fastcnc_orders only — that's the surface the admin policy below filters.
revoke all on public.app_admins     from anon, authenticated;
revoke all on public.fastcnc_orders from anon;
revoke insert, update, delete on public.fastcnc_orders from authenticated;
grant  select on public.fastcnc_orders to authenticated;

-- Membership check MUST be a security definer function (same pattern/reason as 0001's
-- is_account_member): a plain `exists (select … from app_admins)` inside a policy runs as
-- the querying user, so app_admins' own RLS (no select policy) hides every row and the
-- check is ALWAYS false — an enrolled admin would see zero orders. security definer runs
-- as the table owner, which bypasses app_admins RLS. Proven by A/B test on Postgres 16.
create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.app_admins a where a.user_id = (select auth.uid())
  );
$$;

create policy "admins read orders" on public.fastcnc_orders
  for select to authenticated
  using (public.is_app_admin());

create policy "admins read order files" on storage.objects
  for select to authenticated
  using (bucket_id = 'fastcnc-orders' and public.is_app_admin());
