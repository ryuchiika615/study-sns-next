-- 1. Track monthly ranking winners
create table if not exists ranking_rewards (
  id uuid primary key default gen_random_uuid(),
  year_month text not null,
  user_id uuid not null references profiles(id) on delete cascade,
  rank int not null,
  study_minutes int not null default 0,
  awarded_at timestamptz not null default now(),
  unique (year_month, rank)
);

alter table ranking_rewards enable row level security;
create policy "rewards_select" on ranking_rewards for select using (true);

-- 2. Special items that can be awarded by the system
create table if not exists special_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('title', 'icon')),
  rarity text not null default 'LR',
  unique (name, category)
);

insert into special_items (name, category, rarity) values
  ('{month}月の勉強王', 'title', 'LR'),
  ('王冠', 'icon', 'LR')
on conflict (name, category) do nothing;
