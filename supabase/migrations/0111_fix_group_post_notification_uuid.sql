-- UUID 型には min(uuid) が存在しないため、グループ通知を作る際に
-- 代表の group_id を text として集計してから UUID に戻す。
-- これにより通知あり・通知なしのどちらでもグループ投稿が完了する。

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

  -- p_silent=true のときは通知関連の処理を完全に通さない。
  if not p_silent then
    insert into public.notifications (recipient_id, sender_id, post_id, group_id, notification_type, message)
    select m.user_id, auth.uid(), v_post_id, min(s.group_id::text)::uuid, 'group_post',
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
