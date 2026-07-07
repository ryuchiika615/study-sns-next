-- Study engagement: streaks, daily logs, deck sharing

-- Streak tracking
create table if not exists study_streaks (
  user_id uuid primary key references profiles(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_study_date date not null,
  updated_at timestamptz not null default now()
);

-- Daily study logs (for calendar heatmap and stats)
create table if not exists daily_study_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  cards_reviewed int not null default 0,
  cards_new int not null default 0,
  study_minutes int not null default 0,
  unique(user_id, date)
);

-- Deck sharing columns
alter table decks add column if not exists is_public boolean not null default false;
alter table decks add column if not exists original_author_id uuid references profiles(id);

-- Indexes
create index if not exists idx_daily_logs_user on daily_study_logs(user_id, date);

-- RLS
alter table study_streaks enable row level security;
alter table daily_study_logs enable row level security;

create policy "streaks_select" on study_streaks for select using (auth.uid() = user_id);
create policy "streaks_insert" on study_streaks for insert with check (auth.uid() = user_id);
create policy "streaks_update" on study_streaks for update using (auth.uid() = user_id);

create policy "daily_logs_select" on daily_study_logs for select using (auth.uid() = user_id);
create policy "daily_logs_insert" on daily_study_logs for insert with check (auth.uid() = user_id);
create policy "daily_logs_update" on daily_study_logs for update using (auth.uid() = user_id);
