-- BGM request table for users to request YouTube -> MP3 conversion
create table if not exists bgm_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  youtube_url text not null,
  title text,
  status text not null default 'pending' check (status in ('pending','processing','completed','rejected')),
  admin_note text,
  created_at timestamptz not null default now()
);

-- RLS: users can insert/select their own, admin can select all
alter table bgm_requests enable row level security;

drop policy if exists "Users can insert own requests" on bgm_requests;
create policy "Users can insert own requests" on bgm_requests
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can view own requests" on bgm_requests;
create policy "Users can view own requests" on bgm_requests
  for select using (auth.uid() = user_id);

drop policy if exists "Admins can view all requests" on bgm_requests;
create policy "Admins can view all requests" on bgm_requests
  for select using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "Admins can update requests" on bgm_requests;
create policy "Admins can update requests" on bgm_requests
  for update using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );
