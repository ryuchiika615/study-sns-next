-- 投稿を削除しても「これまで投稿した回数」は減らさない。
-- 実績・称号の投稿数条件は、この累計値を使う。

alter table public.profiles
  add column if not exists total_posts_created integer not null default 0;

-- 現在残っている投稿を初期値にする。過去に削除済みの投稿は復元しない。
update public.profiles profile
set total_posts_created = greatest(
  coalesce(profile.total_posts_created, 0),
  coalesce((select count(*) from public.posts post where post.user_id = profile.id), 0)
);

create or replace function public.track_lifetime_post_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set total_posts_created = coalesce(total_posts_created, 0) + 1
   where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists posts_track_lifetime_count on public.posts;
create trigger posts_track_lifetime_count
after insert on public.posts
for each row execute function public.track_lifetime_post_count();

-- 称号文字の自動解放も、削除で減らない累計投稿数を参照する。
create or replace function public.sync_title_characters()
returns json language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_streak integer := 0;
  v_study_minutes integer := 0;
  v_workout_minutes integer := 0;
  v_post_count integer := 0;
  v_active_days integer := 0;
  v_challenge_wins integer := 0;
  v_habit_streak integer := 0;
  v_subject_count integer := 0;
  v_current_habit_streak integer := 0;
  v_log record;
  v_seen_dates date[] := array[]::date[];
  v_definition record;
  v_reached boolean;
  v_new jsonb := '[]'::jsonb;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  select coalesce(longest_streak, 0) into v_streak from public.study_streaks where user_id = v_user_id;
  select coalesce(total_posts_created, 0) into v_post_count from public.profiles where id = v_user_id;
  select coalesce(sum(study_minutes), 0), coalesce(sum(workout_minutes), 0), count(distinct created_at::date)
    into v_study_minutes, v_workout_minutes, v_active_days
    from public.posts where user_id = v_user_id;
  select count(*) into v_challenge_wins from public.challenges where winner_id = v_user_id and status = 'completed';
  select count(distinct subject) into v_subject_count from public.posts where user_id = v_user_id and coalesce(subject, '') <> '';

  for v_log in select date, achieved from public.habit_logs where user_id = v_user_id order by date desc limit 365 loop
    if v_log.achieved and not (v_log.date = any(v_seen_dates)) then
      v_current_habit_streak := v_current_habit_streak + 1;
      v_seen_dates := array_append(v_seen_dates, v_log.date);
    elsif not v_log.achieved then
      v_habit_streak := greatest(v_habit_streak, v_current_habit_streak);
      v_current_habit_streak := 0;
    end if;
  end loop;
  v_habit_streak := greatest(v_habit_streak, v_current_habit_streak);

  for v_definition in select * from public.title_character_definitions order by sort_order loop
    v_reached := case v_definition.condition_type
      when 'streak' then v_streak >= v_definition.threshold
      when 'study_minutes' then v_study_minutes >= v_definition.threshold
      when 'workout_minutes' then v_workout_minutes >= v_definition.threshold
      when 'post_count' then v_post_count >= v_definition.threshold
      when 'active_days' then v_active_days >= v_definition.threshold
      when 'challenge_wins' then v_challenge_wins >= v_definition.threshold
      when 'habit_streak' then v_habit_streak >= v_definition.threshold
      when 'subject_count' then v_subject_count >= v_definition.threshold
      else false
    end;
    if v_reached and not exists (
      select 1 from public.user_title_characters u where u.user_id = v_user_id and u.definition_id = v_definition.id
    ) then
      insert into public.user_title_characters (user_id, definition_id) values (v_user_id, v_definition.id);
      v_new := v_new || jsonb_build_array(jsonb_build_object('id', v_definition.id, 'character', v_definition.character, 'label', v_definition.label, 'rarity', v_definition.rarity));
    end if;
  end loop;
  return json_build_object('new_characters', v_new);
end;
$$;

grant execute on function public.sync_title_characters() to authenticated;
