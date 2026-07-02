-- Add audio columns to posts table
alter table posts add column if not exists audio_url text;
alter table posts add column if not exists audio_name text;

-- Update create_post RPC to accept audio params
create or replace function create_post(
  p_content text,
  p_subject text default 'その他',
  p_study_minutes integer default 0,
  p_image_url text default null,
  p_image_urls text[] default null,
  p_study_date text default null,
  p_quote_post_id uuid default null,
  p_silent boolean default false,
  p_audio_url text default null,
  p_audio_name text default null
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
  v_reaction_count integer;
  v_follower_count integer;
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

  insert into public.posts (user_id, content, subject, study_minutes, image_url, image_urls, quote_post_id, is_silent, audio_url, audio_name, created_at)
  values (v_user_id, p_content, p_subject, p_study_minutes, p_image_url, p_image_urls, p_quote_post_id, p_silent, p_audio_url, p_audio_name, v_created_at)
  returning id into v_post_id;

  v_last_date := v_profile.last_post_date;
  v_streak := coalesce(v_profile.consecutive_post_days, 0);
  v_exchange_points := coalesce(v_profile.exchange_points, 0);
  v_bonus_points := 0;
  v_is_new_streak := false;

  -- Streak calculation (only for same-day posts)
  if not v_is_backdate then
    if v_last_date = v_today then
      null;
    elsif v_last_date = v_yesterday then
      v_streak := v_streak + 1;
      v_is_new_streak := true;
    elsif v_last_date is null or v_last_date < v_yesterday then
      v_streak := 1;
      v_is_new_streak := true;
    end if;

    if v_is_new_streak then
      if v_streak >= 8 then
        v_bonus_points := 100;
      elsif v_streak = 7 then
        v_bonus_points := 64;
      elsif v_streak = 6 then
        v_bonus_points := 32;
      elsif v_streak = 5 then
        v_bonus_points := 16;
      elsif v_streak = 4 then
        v_bonus_points := 8;
      elsif v_streak = 3 then
        v_bonus_points := 4;
      elsif v_streak = 2 then
        v_bonus_points := 2;
      else
        v_bonus_points := 1;
      end if;
    end if;

    update public.profiles
    set consecutive_post_days = v_streak,
        last_post_date = v_today
    where id = v_user_id;
  end if;

  -- Points calculation
  select count(*) into v_reaction_count from public.post_reactions where post_id = v_post_id;

  select count(*) into v_follower_count from public.follows where following_id = v_user_id;
  v_multiplier := 1.0 + (v_follower_count * 0.1);

  v_earned := v_bonus_points + (v_reaction_count * 10) + floor(p_study_minutes * v_multiplier);

  update public.profiles
  set exchange_points = v_exchange_points + v_earned
  where id = v_user_id;

  return json_build_object(
    'post_id', v_post_id,
    'streak', json_build_object('streak', v_streak, 'bonus_points', v_bonus_points)
  );
end;
$$;

-- Allow inserting into audio_bgm for any user (adding shared BGM)
-- Owner still controls their own, but we need insert permission
drop policy if exists "Anyone can insert shared BGM" on audio_bgm;
create policy "Anyone can insert shared BGM" on audio_bgm
  for insert with check (true);
