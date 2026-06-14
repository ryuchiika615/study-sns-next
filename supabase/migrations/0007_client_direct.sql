-- Phase 1: Client-side direct operation support
-- Auto notification triggers (replaces API-route notification creation)

-- Like → 通知（自分へのいいねは除外）
create or replace function notify_on_like()
returns trigger as $$
begin
  insert into public.notifications (recipient_id, sender_id, post_id, notification_type)
  select p.user_id, new.user_id, new.post_id, 'like'
  from public.posts p
  where p.id = new.post_id and p.user_id != new.user_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_on_like on public.likes;
create trigger trg_notify_on_like
  after insert on public.likes
  for each row execute function notify_on_like();

-- コメント → 通知
create or replace function notify_on_comment()
returns trigger as $$
begin
  insert into public.notifications (recipient_id, sender_id, post_id, notification_type)
  select p.user_id, new.user_id, new.post_id, 'reply'
  from public.posts p
  where p.id = new.post_id and p.user_id != new.user_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_on_comment on public.comments;
create trigger trg_notify_on_comment
  after insert on public.comments
  for each row execute function notify_on_comment();

-- フォロー → 通知
create or replace function notify_on_follow()
returns trigger as $$
begin
  insert into public.notifications (recipient_id, sender_id, notification_type)
  values (new.following_id, new.follower_id, 'follow');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_on_follow on public.follows;
create trigger trg_notify_on_follow
  after insert on public.follows
  for each row execute function notify_on_follow();

-- 投稿作成 + ストリーク計算（まとめて1回のDB呼び出し）
create or replace function create_post(
  p_content text,
  p_subject text default 'その他',
  p_study_minutes integer default 0,
  p_image_url text default null,
  p_study_date text default null
) returns json
language plpgsql security definer
as $$
declare
  v_user_id uuid;
  v_profile record;
  v_today date;
  v_is_backdate boolean;
  v_created_at timestamptz;
  v_post_id uuid;
  v_streak integer;
  v_bonus_points integer;
  v_is_new_streak boolean;
  v_total_points integer;
  v_exchange_points integer;
  v_last_date date;
  v_yesterday date;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from public.profiles where id = v_user_id;
  if v_profile is null then
    raise exception 'Profile not found';
  end if;

  v_today := (timezone('JST', now()))::date;
  v_yesterday := (timezone('JST', now()) - interval '1 day')::date;
  v_is_backdate := p_study_date is not null and p_study_date::date != v_today;

  if v_is_backdate then
    v_created_at := (p_study_date || 'T12:00:00+09:00')::timestamptz;
  else
    v_created_at := now();
  end if;

  insert into public.posts (user_id, content, subject, study_minutes, image_url, created_at)
  values (v_user_id, p_content, p_subject, p_study_minutes, p_image_url, v_created_at)
  returning id into v_post_id;

  v_last_date := v_profile.last_post_date;
  v_streak := coalesce(v_profile.consecutive_post_days, 0);
  v_total_points := coalesce(v_profile.points, 0);
  v_exchange_points := coalesce(v_profile.exchange_points, 0);
  v_bonus_points := 0;
  v_is_new_streak := false;

  if v_last_date != v_today then
    if v_last_date = v_yesterday then
      v_streak := v_streak + 1;
    else
      v_streak := 1;
    end if;

    v_bonus_points := case when v_streak <= 7 then (2::numeric ^ (v_streak - 1))::integer else 100 end;
    v_total_points := v_total_points + p_study_minutes + v_bonus_points;
    v_exchange_points := v_exchange_points + v_bonus_points;
    v_is_new_streak := true;
  else
    v_total_points := v_total_points + p_study_minutes;
  end if;

  update public.profiles set
    points = v_total_points,
    exchange_points = v_exchange_points,
    consecutive_post_days = v_streak,
    last_post_date = v_today
  where id = v_user_id;

  if v_is_new_streak then
    return json_build_object(
      'post_id', v_post_id,
      'streak', json_build_object('streak', v_streak, 'bonus_points', v_bonus_points)
    );
  else
    return json_build_object('post_id', v_post_id, 'streak', null);
  end if;
end;
$$;

-- Storage RLS
drop policy if exists "post_images_select" on storage.objects;
create policy "post_images_select" on storage.objects
  for select using (bucket_id = 'post-images');

drop policy if exists "post_images_insert" on storage.objects;
create policy "post_images_insert" on storage.objects
  for insert with check (bucket_id = 'post-images' and auth.role() = 'authenticated');

drop policy if exists "avatars_select" on storage.objects;
create policy "avatars_select" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_insert" on storage.objects;
create policy "avatars_insert" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- gacha_items: RLS有効化＋全員閲覧可＋誰でも追加可（カタログなので）
alter table gacha_items enable row level security;
drop policy if exists "gacha_items_select" on gacha_items;
create policy "gacha_items_select" on gacha_items for select using (true);
drop policy if exists "gacha_items_insert" on gacha_items;
create policy "gacha_items_insert" on gacha_items for insert with check (true);

-- login_sessions: 本人のみ閲覧
drop policy if exists "login_sessions_select" on login_sessions;
create policy "login_sessions_select" on login_sessions for select using (auth.uid() = user_id);
