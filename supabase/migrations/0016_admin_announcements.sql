create table if not exists admin_announcements (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists announcement_reads (
  user_id uuid references profiles(id) on delete cascade,
  announcement_id uuid references admin_announcements(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, announcement_id)
);

alter table admin_announcements enable row level security;
alter table announcement_reads enable row level security;

-- Everyone can select announcements (only admins insert/delete via API)
create policy "announcements_select" on admin_announcements for select using (true);
-- Everyone can manage their own read status
create policy "reads_select" on announcement_reads for select using (auth.uid() = user_id);
create policy "reads_insert" on announcement_reads for insert with check (auth.uid() = user_id);
