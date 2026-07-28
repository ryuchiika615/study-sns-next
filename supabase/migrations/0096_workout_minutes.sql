-- Add workout_minutes column to posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS workout_minutes integer DEFAULT 0;

-- Update create_post RPC to accept workout_minutes
CREATE OR REPLACE FUNCTION create_post(
  p_content text,
  p_subject text DEFAULT 'その他',
  p_study_minutes integer DEFAULT 0,
  p_image_url text DEFAULT null,
  p_image_urls text[] DEFAULT null,
  p_study_date text DEFAULT null,
  p_quote_post_id uuid DEFAULT null,
  p_quote_comment_id uuid DEFAULT null,
  p_silent boolean DEFAULT false,
  p_audio_url text DEFAULT null,
  p_audio_name text DEFAULT null,
  p_workout_minutes integer DEFAULT 0
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
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
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  v_today := (timezone('JST', now()))::date;
  v_yesterday := (timezone('JST', now()) - interval '1 day')::date;
  v_is_backdate := p_study_date IS NOT NULL AND p_study_date::date != v_today;

  IF v_is_backdate THEN
    v_created_at := (p_study_date || 'T12:00:00+09:00')::timestamptz;
  ELSE
    v_created_at := now();
  END IF;

  INSERT INTO public.posts (user_id, content, subject, study_minutes, image_url, image_urls, quote_post_id, quote_comment_id, is_silent, audio_url, audio_name, created_at, workout_minutes)
  VALUES (v_user_id, p_content, p_subject, p_study_minutes, p_image_url, p_image_urls, p_quote_post_id, p_quote_comment_id, p_silent, p_audio_url, p_audio_name, v_created_at, p_workout_minutes)
  RETURNING id INTO v_post_id;

  v_last_date := v_profile.last_post_date;
  v_streak := coalesce(v_profile.consecutive_post_days, 0);
  v_exchange_points := coalesce(v_profile.exchange_points, 0);
  v_bonus_points := 0;
  v_is_new_streak := false;

  IF NOT v_is_backdate THEN
    IF v_last_date = v_today THEN
      NULL;
    ELSIF v_last_date = v_yesterday THEN
      v_streak := v_streak + 1;
      v_is_new_streak := true;
    ELSIF v_last_date IS NULL OR v_last_date < v_yesterday THEN
      v_streak := 1;
      v_is_new_streak := true;
    END IF;

    IF v_is_new_streak THEN
      IF v_streak >= 8 THEN
        v_bonus_points := 100;
      ELSIF v_streak = 7 THEN
        v_bonus_points := 64;
      ELSIF v_streak = 6 THEN
        v_bonus_points := 32;
      ELSIF v_streak = 5 THEN
        v_bonus_points := 16;
      ELSIF v_streak = 4 THEN
        v_bonus_points := 8;
      ELSIF v_streak = 3 THEN
        v_bonus_points := 4;
      ELSIF v_streak = 2 THEN
        v_bonus_points := 2;
      ELSE
        v_bonus_points := 1;
      END IF;
    END IF;

    UPDATE public.profiles
    SET consecutive_post_days = v_streak,
        last_post_date = v_today
    WHERE id = v_user_id;
  END IF;

  SELECT count(*) INTO v_reaction_count FROM public.post_reactions WHERE post_id = v_post_id;
  SELECT count(*) INTO v_follower_count FROM public.follows WHERE following_id = v_user_id;
  v_multiplier := 1.0 + (v_follower_count * 0.1);
  v_earned := v_bonus_points + (v_reaction_count * 10) + floor(p_study_minutes * v_multiplier) + floor(p_workout_minutes * v_multiplier);

  UPDATE public.profiles
  SET exchange_points = v_exchange_points + v_earned
  WHERE id = v_user_id;

  RETURN json_build_object(
    'post_id', v_post_id,
    'streak', json_build_object('streak', v_streak, 'bonus_points', v_bonus_points)
  );
END;
$$;
