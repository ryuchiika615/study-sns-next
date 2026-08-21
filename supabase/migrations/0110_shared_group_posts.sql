-- 1つの投稿を複数の学習グループに共有するための中間テーブル。
-- posts.group_id は既存データ・旧コードとの互換用に残し、削除しない。

create table if not exists public.post_group_shares (
  post_id uuid not null references public.posts(id) on delete cascade,
  group_id uuid not null references public.study_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, group_id)
);

create index if not exists idx_post_group_shares_group_created
  on public.post_group_shares(group_id, created_at desc);
create index if not exists idx_post_group_shares_post
  on public.post_group_shares(post_id);

-- 既存の1グループ投稿を、安全に共有テーブルへ引き継ぐ（再実行可能）。
insert into public.post_group_shares (post_id, group_id, created_at)
select id, group_id, created_at from public.posts where group_id is not null
on conflict (post_id, group_id) do nothing;

alter table public.post_group_shares enable row level security;
drop policy if exists "post_group_shares_read_member" on public.post_group_shares;
create policy "post_group_shares_read_member" on public.post_group_shares for select using (
  exists (
    select 1 from public.study_group_members m
    where m.group_id = post_group_shares.group_id and m.user_id = auth.uid()
  )
);

-- 公開投稿は共有先が0件、グループ投稿は共有先のどれかのメンバーだけが閲覧できる。
create or replace function public.can_access_post(p_post_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post_id and (
      not exists (select 1 from public.post_group_shares s where s.post_id = p.id)
      or exists (
        select 1 from public.post_group_shares s
        join public.study_group_members m on m.group_id = s.group_id
        where s.post_id = p.id and m.user_id = auth.uid()
      )
    )
  );
$$;

drop policy if exists "posts_select" on public.posts;
create policy "posts_select" on public.posts for select using (
  not exists (select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = posts.user_id)
  and public.can_access_post(posts.id)
);

-- 投稿本体を1件作り、現在のグループと選択グループだけを関連付ける。
-- 関数内なので、メンバー確認・投稿作成・共有先登録は1つのトランザクションで完了する。
drop function if exists public.create_group_post(uuid, text, text, integer, text, text[], text, uuid, uuid, boolean, text, text, integer, integer, integer);
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
  p_total_pages integer default 0,
  p_shared_group_ids uuid[] default array[]::uuid[]
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_result json;
  v_post_id uuid;
  v_group_ids uuid[];
begin
  v_group_ids := array(select distinct x from unnest(array_append(coalesce(p_shared_group_ids, array[]::uuid[]), p_group_id)) as x);
  if auth.uid() is null or exists (
    select 1 from unnest(v_group_ids) g
    where not exists (select 1 from public.study_group_members m where m.group_id = g and m.user_id = auth.uid())
  ) then
    raise exception '参加していないグループには共有できません。' using errcode = 'insufficient_privilege';
  end if;

  if p_quote_post_id is not null and not exists (
    select 1 from public.post_group_shares s where s.post_id = p_quote_post_id and s.group_id = p_group_id
  ) then raise exception 'このグループにない投稿は引用できません。'; end if;
  if p_quote_comment_id is not null and not exists (
    select 1 from public.comments c join public.post_group_shares s on s.post_id = c.post_id
    where c.id = p_quote_comment_id and s.group_id = p_group_id
  ) then raise exception 'このグループにないコメントは引用できません。'; end if;

  v_result := public.create_post(p_content, p_subject, p_study_minutes, p_image_url, p_image_urls, p_study_date, p_quote_post_id, p_quote_comment_id, p_silent, p_audio_url, p_audio_name, p_workout_minutes, p_pages_completed, p_total_pages);
  v_post_id := (v_result ->> 'post_id')::uuid;
  update public.posts set group_id = p_group_id where id = v_post_id and user_id = auth.uid();
  insert into public.post_group_shares (post_id, group_id)
  select v_post_id, g from unnest(v_group_ids) as g;
  -- 複数の共有先に同じ人がいても、通知は1件だけにまとめる。
  if not p_silent then
    insert into public.notifications (recipient_id, sender_id, post_id, group_id, notification_type, message)
    select m.user_id, auth.uid(), v_post_id, min(s.group_id), 'group_post',
      case when cardinality(v_group_ids) > 1 then 'グループに新しい投稿があります（複数グループに共有）' else 'グループに新しい投稿があります' end
    from public.post_group_shares s
    join public.study_group_members m on m.group_id = s.group_id
    where s.post_id = v_post_id and m.user_id <> auth.uid() and m.notify_posts
      and not exists (select 1 from public.user_blocks b where b.blocker_id = m.user_id and b.blocked_id = auth.uid())
    group by m.user_id;
  end if;
  return v_result;
end;
$$;
