-- 1. Merge points: all earnings go to exchange_points; merge existing points
update profiles set exchange_points = exchange_points + points;

-- 2. like_rewards table (prevents double-points & double-notification per liker per post)
create table if not exists like_rewards (
  liker_id uuid references profiles(id) on delete cascade,
  post_id uuid references posts(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (liker_id, post_id)
);

-- 3. Drop old notify_on_like trigger & function
drop trigger if exists trg_notify_on_like on likes;
drop function if exists notify_on_like() cascade;

-- 4. New unified like processor: award 10pt + notify (once per liker per post)
create or replace function process_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_author_id uuid;
  v_is_followed boolean;
begin
  if new.user_id = (select user_id from posts where id = new.post_id) then
    return new; -- self-like, skip
  end if;

  select user_id into v_author_id from posts where id = new.post_id;

  -- Track reward (only first time per liker per post)
  insert into like_rewards (liker_id, post_id)
  values (new.user_id, new.post_id)
  on conflict do nothing;

  if found then
    -- Award 10pt to post author
    update profiles set exchange_points = exchange_points + 10
    where id = v_author_id;

    -- Notify only if followed with notify_likes enabled
    select exists(
      select 1 from follows
      where follower_id = new.user_id
        and following_id = v_author_id
        and notify_likes = true
    ) into v_is_followed;

    if v_is_followed then
      insert into notifications (recipient_id, sender_id, post_id, notification_type)
      values (v_author_id, new.user_id, new.post_id, 'like');
    end if;
  end if;

  return new;
end;
$$;

create trigger process_like_trigger
  after insert on likes
  for each row execute function process_like();

-- 5. Follower multiplier function
create or replace function get_follower_multiplier(p_user_id uuid)
returns numeric language sql stable as $$
  select case
    when (select count(*) from follows where following_id = p_user_id) > 0
      then 1.01 + (select count(*)::numeric * 0.001 from follows where following_id = p_user_id)
    else 1.0
  end;
$$;

-- 6. Updated create_post: merged points + follower multiplier
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
  v_exchange_points integer;
  v_last_date date;
  v_yesterday date;
  v_multiplier numeric;
  v_earned integer;
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
  v_exchange_points := coalesce(v_profile.exchange_points, 0);
  v_bonus_points := 0;
  v_is_new_streak := false;
  v_multiplier := get_follower_multiplier(v_user_id);

  if v_last_date != v_today then
    if v_last_date = v_yesterday then
      v_streak := v_streak + 1;
    else
      v_streak := 1;
    end if;

    v_bonus_points := case when v_streak <= 7 then (2::numeric ^ (v_streak - 1))::integer else 100 end;
    v_earned := (p_study_minutes + v_bonus_points) * v_multiplier;
    v_exchange_points := v_exchange_points + v_earned;
    v_is_new_streak := true;
  else
    -- Same-day repost: no streak bonus, no multiplier
    v_exchange_points := v_exchange_points + p_study_minutes;
  end if;

  update public.profiles set
    exchange_points = v_exchange_points,
    consecutive_post_days = v_streak,
    last_post_date = v_today
  where id = v_user_id;

  if v_is_new_streak then
    return json_build_object(
      'post_id', v_post_id,
      'streak', json_build_object('streak', v_streak, 'bonus_points', v_earned),
      'multiplier', v_multiplier
    );
  else
    return json_build_object('post_id', v_post_id, 'streak', null, 'multiplier', null);
  end if;
end;
$$;
