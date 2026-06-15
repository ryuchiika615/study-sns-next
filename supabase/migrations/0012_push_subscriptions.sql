create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  endpoint text not null,
  p256dh_key text not null,
  auth_key text not null,
  created_at timestamptz not null default now(),
  unique(user_id, endpoint)
);

alter table push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_insert" on push_subscriptions;
create policy "push_subscriptions_insert" on push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_select" on push_subscriptions;
create policy "push_subscriptions_select" on push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "push_subscriptions_delete" on push_subscriptions;
create policy "push_subscriptions_delete" on push_subscriptions
  for delete using (auth.uid() = user_id);
