-- 1. Post reactions (stamps)
create table if not exists post_reactions (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table post_reactions enable row level security;

create policy "reactions_select" on post_reactions for select using (true);
create policy "reactions_insert" on post_reactions for insert with check (auth.uid() = user_id);
create policy "reactions_update" on post_reactions for update using (auth.uid() = user_id);
create policy "reactions_delete" on post_reactions for delete using (auth.uid() = user_id);

-- 2. Notification settings (quiet hours)
create table if not exists notification_settings (
  user_id uuid primary key references profiles(id) on delete cascade,
  quiet_hours_start time null,
  quiet_hours_end time null,
  updated_at timestamptz not null default now()
);

alter table notification_settings enable row level security;

create policy "notif_settings_select" on notification_settings for select using (auth.uid() = user_id);
create policy "notif_settings_insert" on notification_settings for insert with check (auth.uid() = user_id);
create policy "notif_settings_update" on notification_settings for update using (auth.uid() = user_id);

-- 3. Muted users (per-user mute)
create table if not exists muted_users (
  user_id uuid not null references profiles(id) on delete cascade,
  muted_user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, muted_user_id)
);

alter table muted_users enable row level security;

create policy "muted_select" on muted_users for select using (auth.uid() = user_id);
create policy "muted_insert" on muted_users for insert with check (auth.uid() = user_id);
create policy "muted_delete" on muted_users for delete using (auth.uid() = user_id);
