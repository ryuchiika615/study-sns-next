-- Textbooks for study planning and progress tracking

create table if not exists textbooks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  total_pages integer not null default 0,
  pages_completed integer not null default 0,
  target_end_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table textbooks enable row level security;

create policy "Users can read own textbooks"
  on textbooks for select
  using (auth.uid() = user_id);

create policy "Users can insert own textbooks"
  on textbooks for insert
  with check (auth.uid() = user_id);

create policy "Users can update own textbooks"
  on textbooks for update
  using (auth.uid() = user_id);

create policy "Users can delete own textbooks"
  on textbooks for delete
  using (auth.uid() = user_id);

-- Daily progress logs for calendar view
create table if not exists textbook_progress_logs (
  id uuid default gen_random_uuid() primary key,
  textbook_id uuid references textbooks(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  pages_completed integer not null default 0,
  date date not null default current_date,
  created_at timestamptz default now()
);

alter table textbook_progress_logs enable row level security;

create policy "Users can read own logs"
  on textbook_progress_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own logs"
  on textbook_progress_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own logs"
  on textbook_progress_logs for delete
  using (auth.uid() = user_id);

create index if not exists textbooks_user_id_idx on textbooks(user_id);
create index if not exists textbook_logs_user_date_idx on textbook_progress_logs(user_id, date);
