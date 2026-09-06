create table if not exists public.digital_product_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_key text not null,
  checkout_session_id text not null unique,
  payment_intent_id text,
  amount_total integer not null,
  currency text not null default 'jpy',
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, product_key)
);

alter table public.digital_product_orders enable row level security;
drop policy if exists "Users can read own digital product orders" on public.digital_product_orders;
create policy "Users can read own digital product orders"
  on public.digital_product_orders for select
  using (auth.uid() = user_id);

create index if not exists digital_product_orders_user_product_idx
  on public.digital_product_orders(user_id, product_key);
