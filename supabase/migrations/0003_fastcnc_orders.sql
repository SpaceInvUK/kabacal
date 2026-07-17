-- 0003: doors-online order intake (Etapa 3) — orders landed from the FastCNC site bridge.
-- Deny-by-default like 0001: RLS on, NO policies — only the service_role (order-intake
-- Edge Function) reads/writes. Files live in the private 'fastcnc-orders' bucket.

create table if not exists public.fastcnc_orders (
  id            bigint generated always as identity primary key,
  order_id      bigint      not null unique,          -- WooCommerce order id
  order_number  text        not null,                 -- display number (FC-{n})
  site_url      text        not null default '',
  payload       jsonb       not null,                 -- kabacal-order/v1 snapshot (money truth)
  status        text        not null default 'received',  -- received | files_generated | failed
  files         jsonb,                                 -- [{name, path, bytes}] in the bucket
  email_sent_at timestamptz,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.fastcnc_orders enable row level security;
-- no policies on purpose: anon/authenticated see nothing; service_role bypasses RLS.

insert into storage.buckets (id, name, public)
values ('fastcnc-orders', 'fastcnc-orders', false)
on conflict (id) do nothing;
