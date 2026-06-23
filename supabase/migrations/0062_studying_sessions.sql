create table if not exists public.studying_sessions (
  user_id uuid not null references auth.users(id) on delete cascade primary key,
  heartbeat_at timestamptz not null default now()
);

alter table public.studying_sessions enable row level security;

create policy "Anyone can read studying_sessions"
  on public.studying_sessions for select
  using (true);

create policy "Users can insert their own session"
  on public.studying_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own session"
  on public.studying_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete their own session"
  on public.studying_sessions for delete
  using (auth.uid() = user_id);
