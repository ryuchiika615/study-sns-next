-- Multi-image support: add image_urls array column
alter table posts add column if not exists image_urls text[];

-- Migrate existing single image_url values into image_urls
update posts set image_urls = array[image_url] where image_url is not null and image_urls is null;

-- Update create_post to accept image_urls array
create or replace function create_post(
  p_content text,
  p_subject text default 'その他',
  p_study_minutes integer default 0,
  p_image_url text default null,
  p_image_urls text[] default null,
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
  v_images text[];
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from public.profiles where id = v_user_id;
  if v_profile is null then
    raise exception 'Profile not found';
  end if;

  -- Merge image sources: prefer p_image_urls, fall back to p_image_url
  if p_image_urls is not null then
    v_images := p_image_urls;
  elsif p_image_url is not null then
    v_images := array[p_image_url];
  else
    v_images := '{}';
  end if;

  v_today := (timezone('JST', now()))::date;
  v_yesterday := (timezone('JST', now()) - interval '1 day')::date;
  v_is_backdate := p_study_date is not null and p_study_date::date != v_today;

  if v_is_backdate then
    v_created_at := (p_study_date || 'T12:00:00+09:00')::timestamptz;
  else
    v_created_at := now();
  end if;

  insert into public.posts (user_id, content, subject, study_minutes, image_url, image_urls, created_at)
  values (v_user_id, p_content, p_subject, p_study_minutes, p_image_url, v_images, v_created_at)
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
