-- グループ管理、学習勝負、通知、ブロック・通報

alter table public.study_group_members add column if not exists notify_posts boolean not null default true;
alter table public.study_group_members add column if not exists notify_rank boolean not null default true;

create table if not exists public.study_group_challenges (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 300),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists idx_group_challenges_group_dates on public.study_group_challenges(group_id, ends_at desc);

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  post_id uuid references public.posts(id) on delete set null,
  group_id uuid references public.study_groups(id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.notifications add column if not exists group_id uuid references public.study_groups(id) on delete cascade;
alter table public.notifications add column if not exists message text;
alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check check (notification_type in ('like','reply','follow','follow_post','gift','mention','admin_announcement','repost','comment_like','challenge','challenge_complete','group_post','group_rank','group_challenge'));

alter table public.study_group_challenges enable row level security;
alter table public.user_blocks enable row level security;
alter table public.reports enable row level security;

-- 途中で実行が止まっても、そのまま再実行できるよう既存ポリシーを置き換える。
drop policy if exists "group_members_update_own_settings" on public.study_group_members;
drop policy if exists "group_challenges_read_members" on public.study_group_challenges;
drop policy if exists "group_challenges_create_owner" on public.study_group_challenges;
drop policy if exists "group_challenges_update_owner" on public.study_group_challenges;
drop policy if exists "group_challenges_delete_owner" on public.study_group_challenges;
drop policy if exists "user_blocks_manage_own" on public.user_blocks;
drop policy if exists "reports_create_own" on public.reports;
drop policy if exists "reports_read_own" on public.reports;

create policy "group_members_update_own_settings" on public.study_group_members for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "group_challenges_read_members" on public.study_group_challenges for select using (exists (select 1 from public.study_group_members m where m.group_id = study_group_challenges.group_id and m.user_id = auth.uid()));
create policy "group_challenges_create_owner" on public.study_group_challenges for insert with check (created_by = auth.uid() and exists (select 1 from public.study_groups g where g.id = group_id and g.owner_id = auth.uid()));
create policy "group_challenges_update_owner" on public.study_group_challenges for update using (exists (select 1 from public.study_groups g where g.id = group_id and g.owner_id = auth.uid()));
create policy "group_challenges_delete_owner" on public.study_group_challenges for delete using (exists (select 1 from public.study_groups g where g.id = group_id and g.owner_id = auth.uid()));
create policy "user_blocks_manage_own" on public.user_blocks for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy "reports_create_own" on public.reports for insert with check (reporter_id = auth.uid());
create policy "reports_read_own" on public.reports for select using (reporter_id = auth.uid());

drop policy if exists "posts_select" on public.posts;
create policy "posts_select" on public.posts for select using (
  not exists (select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = posts.user_id)
  and (group_id is null or exists (select 1 from public.study_group_members m where m.group_id = posts.group_id and m.user_id = auth.uid()) or exists (select 1 from public.study_groups g where g.id = posts.group_id and g.visibility = 'public'))
);
