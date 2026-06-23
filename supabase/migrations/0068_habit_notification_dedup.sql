-- Track sent habit notifications to avoid duplicates
create table if not exists habit_notifications_sent (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  habit_id uuid references habits(id) on delete cascade not null,
  date date not null default current_date,
  sent_at timestamptz not null default now(),
  unique(user_id, habit_id, date)
);
