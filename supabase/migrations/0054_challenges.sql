-- 1. Create challenges table
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.profiles(id) on delete cascade,
  opponent_id uuid not null references public.profiles(id) on delete cascade,
  message text not null default '',
  challenge_type text not null default 'weekly_study_minutes',
  target_value integer not null default 0,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','completed')),
  winner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz
);

alter table public.challenges enable row level security;

create policy "challenges_select" on public.challenges
  for select using (auth.uid() = challenger_id or auth.uid() = opponent_id);

create policy "challenges_insert" on public.challenges
  for insert with check (auth.uid() = challenger_id);

create policy "challenges_update" on public.challenges
  for update using (auth.uid() = challenger_id or auth.uid() = opponent_id);

-- 2. Notification settings columns for challenge
alter table public.notification_settings add column if not exists notify_challenge boolean not null default true;
alter table public.notification_settings add column if not exists vibrate_challenge boolean not null default true;

-- 3. Add 'challenge' to notification_type check
alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check
  check (notification_type in ('like','reply','follow','follow_post','gift','mention','admin_announcement','repost','challenge'));

-- 4. Index for faster queries
create index if not exists idx_challenges_challenger on public.challenges(challenger_id);
create index if not exists idx_challenges_opponent on public.challenges(opponent_id);
create index if not exists idx_challenges_status on public.challenges(status);
