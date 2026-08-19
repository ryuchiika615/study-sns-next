-- 学習グループ：FREEは作成1個、Proは無制限。グループ投稿はメンバーだけが閲覧できる。

create table if not exists public.study_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  description text not null default '' check (char_length(description) <= 300),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  invite_code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_group_members (
  group_id uuid not null references public.study_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists idx_study_group_members_user on public.study_group_members(user_id, joined_at desc);
create index if not exists idx_study_groups_owner on public.study_groups(owner_id, created_at desc);

alter table public.posts add column if not exists group_id uuid references public.study_groups(id) on delete cascade;
create index if not exists idx_posts_group_created on public.posts(group_id, created_at desc) where group_id is not null;

create or replace function public.enforce_study_group_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id <> auth.uid() then
    raise exception 'グループは本人のみ作成できます';
  end if;
  if not exists (
    select 1 from public.pro_grants g
    where g.user_id = auth.uid() and g.revoked_at is null and g.starts_at <= now()
      and (g.expires_at is null or g.expires_at > now())
  ) and (select count(*) from public.study_groups where owner_id = auth.uid()) >= 1 then
    raise exception 'FREEプランで作成できるグループは1個までです。Proなら無制限に作成できます.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_study_group_limit_trigger on public.study_groups;
create trigger enforce_study_group_limit_trigger before insert on public.study_groups
for each row execute function public.enforce_study_group_limit();

create or replace function public.add_study_group_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.study_group_members (group_id, user_id, role)
  values (new.id, new.owner_id, 'owner') on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists add_study_group_owner_trigger on public.study_groups;
create trigger add_study_group_owner_trigger after insert on public.study_groups
for each row execute function public.add_study_group_owner();

alter table public.study_groups enable row level security;
alter table public.study_group_members enable row level security;

create policy "study_groups_read_visible_or_member" on public.study_groups for select using (
  visibility = 'public' or owner_id = auth.uid() or exists (
    select 1 from public.study_group_members m where m.group_id = id and m.user_id = auth.uid()
  )
);
create policy "study_groups_create_own" on public.study_groups for insert with check (owner_id = auth.uid());
create policy "study_groups_update_owner" on public.study_groups for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "study_groups_delete_owner" on public.study_groups for delete using (owner_id = auth.uid());

create policy "study_group_members_read_self" on public.study_group_members for select using (user_id = auth.uid());
create policy "study_group_members_leave_self" on public.study_group_members for delete using (user_id = auth.uid());

-- 既存の全公開ポリシーを、グループ投稿だけメンバー限定へ置き換える。
drop policy if exists "posts_select" on public.posts;
create policy "posts_select" on public.posts for select using (
  group_id is null or exists (
    select 1 from public.study_group_members m where m.group_id = posts.group_id and m.user_id = auth.uid()
  ) or exists (
    select 1 from public.study_groups g where g.id = posts.group_id and g.visibility = 'public'
  )
);
drop policy if exists "posts_insert" on public.posts;
create policy "posts_insert" on public.posts for insert with check (
  auth.uid() = user_id and (group_id is null or exists (
    select 1 from public.study_group_members m where m.group_id = posts.group_id and m.user_id = auth.uid()
  ))
);
drop policy if exists "posts_update" on public.posts;
create policy "posts_update" on public.posts for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id and (group_id is null or exists (
    select 1 from public.study_group_members m where m.group_id = posts.group_id and m.user_id = auth.uid()
  ))
);
