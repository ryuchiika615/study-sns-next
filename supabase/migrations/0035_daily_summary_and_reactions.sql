-- 1. Add daily_summary toggle to notification_settings
alter table notification_settings add column if not exists daily_summary boolean not null default true;

-- 2. Daily summaries tracking
create table if not exists daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  reactions_count int not null default 0,
  followers_count int not null default 0,
  study_minutes int not null default 0,
  points_earned int not null default 0,
  total_points int not null default 0,
  sent_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table daily_summaries enable row level security;
create policy "summaries_select" on daily_summaries for select using (auth.uid() = user_id);
create policy "summaries_insert" on daily_summaries for insert with check (auth.uid() = user_id);

-- 3. Migrate existing likes to 👍 reactions (one-time)
insert into post_reactions (post_id, user_id, reaction)
select post_id, user_id, '👍'
from likes
on conflict (post_id, user_id) do nothing;
