create table if not exists public.weekly_badges (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  created_at timestamptz not null default now(),
  unique(user_id, week_start)
);

alter table public.weekly_badges enable row level security;

create policy "Anyone can read badges"
  on public.weekly_badges for select
  using (true);

create policy "System can insert badges"
  on public.weekly_badges for insert
  with check (true);
