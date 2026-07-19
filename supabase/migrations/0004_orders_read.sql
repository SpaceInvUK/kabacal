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

create policy "admins read orders" on public.fastcnc_orders
  for select to authenticated
  using (exists (select 1 from public.app_admins a where a.user_id = auth.uid()));

create policy "admins read order files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fastcnc-orders'
    and exists (select 1 from public.app_admins a where a.user_id = auth.uid())
  );
