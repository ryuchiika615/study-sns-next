-- Habit tracking tables

create table if not exists habits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

alter table habits enable row level security;

create policy "Users can read own habits"
  on habits for select
  using (auth.uid() = user_id);

create policy "Users can insert own habits"
  on habits for insert
  with check (auth.uid() = user_id);

create policy "Users can update own habits"
  on habits for update
  using (auth.uid() = user_id);

create policy "Users can delete own habits"
  on habits for delete
  using (auth.uid() = user_id);

create index if not exists habits_user_id_idx on habits(user_id);

-- Daily habit logs
create table if not exists habit_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  habit_id uuid references habits(id) on delete cascade not null,
  date date not null,
  achieved boolean not null default false,
  created_at timestamptz default now(),
  unique(user_id, habit_id, date)
);

alter table habit_logs enable row level security;

create policy "Users can read own logs"
  on habit_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own logs"
  on habit_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can upsert own logs"
  on habit_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own logs"
  on habit_logs for update
  using (auth.uid() = user_id);

create policy "Users can delete own logs"
  on habit_logs for delete
  using (auth.uid() = user_id);

create index if not exists habit_logs_user_date_idx on habit_logs(user_id, date);
