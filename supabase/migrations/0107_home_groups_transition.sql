-- ホームを公開掲示板に5206、旧ホームの交流を初期メンバー限定グループへ安全に79fb行する。
-- 注意: このファイルは本番では人数・件数を確認した後に一度だけ実行する。既存の投稿や関連データは削除しない。

alter table public.study_groups add column if not exists system_key text;
create unique index if not exists idx_study_groups_system_key
  on public.study_groups(system_key) where system_key is not null;

-- 移行対象の投稿IDを固定して記録する。再実行しても将来の公開掲示板投稿は移動しない。
create table if not exists public.legacy_home_post_migrations (
  post_id uuid primary key references public.posts(id) on delete cascade,
  group_id uuid not null references public.study_groups(id) on delete cascade,
  migrated_at timestamptz not null default now()
);

-- 関連データのRLSから共通で呼ぶ。公開投稿は全ユーザー、グループ投稿はメンバーだけが参照できる。
create or replace function public.can_access_post(p_post_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post_id
      and (p.group_id is null or exists (
        select 1 from public.study_group_members m
        where m.group_id = p.group_id and m.user_id = auth.uid()
      ))
  );
$$;

create or replace function public.can_access_comment(p_comment_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.comments c
    where c.id = p_comment_id and public.can_access_post(c.post_id)
  );
$$;

-- 旧ホームを非公開の初期メンバーグループへ移行する。
do $$
declare
  v_owner_id uuid;
  v_group_id uuid;
  v_before_posts integer;
  v_migrated_posts integer;
begin
  select id into v_owner_id from public.profiles order by created_at asc nulls last, id asc limit 1;
  if v_owner_id is null then
    raise exception '移行できる既存ユーザーがいません。';
  end if;

  insert into public.study_groups (owner_id, name, description, visibility, system_key)
  values (v_owner_id, '初期メンバー（旧ホーム）', 'リュッターの旧ホーム投稿を引き継いだ、既存メンバー限定の非公開グループです。', 'private', 'legacy-home-2026')
  on conflict (system_key) where system_key is not null do update set name = excluded.name
  returning id into v_group_id;

  -- 実行時点で既存のプロフィールだけを一回だけ参加させる。
  insert into public.study_group_members (group_id, user_id, role)
  select v_group_id, p.id, case when p.id = v_owner_id then 'owner' else 'member' end
  from public.profiles p
  on conflict (group_id, user_id) do nothing;

  select count(*) into v_before_posts from public.posts where group_id is null;
  insert into public.legacy_home_post_migrations (post_id, group_id)
  select p.id, v_group_id from public.posts p
  where p.group_id is null
  on conflict (post_id) do nothing;

  update public.posts p
  set group_id = m.group_id
  from public.legacy_home_post_migrations m
  where p.id = m.post_id and p.group_id is null;

  select count(*) into v_migrated_posts from public.legacy_home_post_migrations where group_id = v_group_id;
  if v_migrated_posts < v_before_posts then
    raise exception '移行検証に失敗しました（移行対象: %件、記録済み: %件）', v_before_posts, v_migrated_posts;
  end if;
end $$;

-- グループは参加メンバーのみ投稿を取得できる。公開グループであっても、タイムラインは参加後のみ閲覧可能。
drop policy if exists "posts_select" on public.posts;
create policy "posts_select" on public.posts for select using (
  group_id is null or exists (
    select 1 from public.study_group_members m where m.group_id = posts.group_id and m.user_id = auth.uid()
  )
);

drop policy if exists "likes_select" on public.likes;
drop policy if exists "likes_insert" on public.likes;
drop policy if exists "likes_delete" on public.likes;
create policy "likes_select" on public.likes for select using (public.can_access_post(post_id));
create policy "likes_insert" on public.likes for insert with check (auth.uid() = user_id and public.can_access_post(post_id));
create policy "likes_delete" on public.likes for delete using (auth.uid() = user_id and public.can_access_post(post_id));

drop policy if exists "comments_select" on public.comments;
drop policy if exists "comments_insert" on public.comments;
drop policy if exists "comments_delete" on public.comments;
create policy "comments_select" on public.comments for select using (public.can_access_post(post_id));
create policy "comments_insert" on public.comments for insert with check (auth.uid() = user_id and public.can_access_post(post_id));
create policy "comments_delete" on public.comments for delete using (auth.uid() = user_id and public.can_access_post(post_id));

drop policy if exists "reactions_select" on public.post_reactions;
drop policy if exists "reactions_insert" on public.post_reactions;
drop policy if exists "reactions_update" on public.post_reactions;
drop policy if exists "reactions_delete" on public.post_reactions;
create policy "reactions_select" on public.post_reactions for select using (public.can_access_post(post_id));
create policy "reactions_insert" on public.post_reactions for insert with check (auth.uid() = user_id and public.can_access_post(post_id));
create policy "reactions_update" on public.post_reactions for update using (auth.uid() = user_id and public.can_access_post(post_id)) with check (auth.uid() = user_id and public.can_access_post(post_id));
create policy "reactions_delete" on public.post_reactions for delete using (auth.uid() = user_id and public.can_access_post(post_id));

drop policy if exists "comment_likes_select" on public.comment_likes;
drop policy if exists "comment_likes_insert" on public.comment_likes;
drop policy if exists "comment_likes_delete" on public.comment_likes;
create policy "comment_likes_select" on public.comment_likes for select using (public.can_access_comment(comment_id));
create policy "comment_likes_insert" on public.comment_likes for insert with check (auth.uid() = user_id and public.can_access_comment(comment_id));
create policy "comment_likes_delete" on public.comment_likes for delete using (auth.uid() = user_id and public.can_access_comment(comment_id));

create index if not exists idx_posts_public_created on public.posts(created_at desc) where group_id is null;

-- 既存のcreate_postの連続日数・ポイント・753b像・5f15用をそのまま再利用して、グループ内の307fに投稿する。
create or replace function public.create_group_post(
  p_group_id uuid,
  p_content text,
  p_subject text default 'その他',
  p_study_minutes integer default 0,
  p_image_url text default null,
  p_image_urls text[] default null,
  p_study_date text default null,
  p_quote_post_id uuid default null,
  p_quote_comment_id uuid default null,
  p_silent boolean default false,
  p_audio_url text default null,
  p_audio_name text default null,
  p_workout_minutes integer default 0,
  p_pages_completed integer default 0,
  p_total_pages integer default 0
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_quote_group_id uuid;
  v_result json;
  v_post_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.study_group_members m where m.group_id = p_group_id and m.user_id = auth.uid()
  ) then
    raise exception 'グループのメンバーの307f投稿できます。' using errcode = 'insufficient_privilege';
  end if;

  if p_quote_post_id is not null then
    select group_id into v_quote_group_id from public.posts where id = p_quote_post_id;
    if v_quote_group_id is distinct from p_group_id then
      raise exception '別の場所の投稿は引用できません。';
    end if;
  end if;
  if p_quote_comment_id is not null then
    select p.group_id into v_quote_group_id from public.comments c join public.posts p on p.id = c.post_id where c.id = p_quote_comment_id;
    if v_quote_group_id is distinct from p_group_id then
      raise exception '別の場所のコメントは引用できません。';
    end if;
  end if;

  v_result := public.create_post(p_content, p_subject, p_study_minutes, p_image_url, p_image_urls, p_study_date, p_quote_post_id, p_quote_comment_id, p_silent, p_audio_url, p_audio_name, p_workout_minutes, p_pages_completed, p_total_pages);
  v_post_id := (v_result ->> 'post_id')::uuid;
  update public.posts set group_id = p_group_id where id = v_post_id and user_id = auth.uid();
  return v_result;
end;
$$;
