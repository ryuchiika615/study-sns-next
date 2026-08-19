-- ホームにはグループ内の本文を出さず、学習・運動の活動記録だけを安全に応援できるようにする。
create table if not exists public.activity_cheers (
  id uuid primary key default gen_random_uuid(),
  activity_post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (activity_post_id, user_id)
);

create index if not exists idx_activity_cheers_post on public.activity_cheers(activity_post_id);

alter table public.activity_cheers enable row level security;

drop policy if exists "activity_cheers_read" on public.activity_cheers;
drop policy if exists "activity_cheers_insert_own" on public.activity_cheers;
drop policy if exists "activity_cheers_delete_own" on public.activity_cheers;

create policy "activity_cheers_read" on public.activity_cheers
  for select using (auth.uid() is not null);
create policy "activity_cheers_insert_own" on public.activity_cheers
  for insert with check (auth.uid() = user_id);
create policy "activity_cheers_delete_own" on public.activity_cheers
  for delete using (auth.uid() = user_id);
