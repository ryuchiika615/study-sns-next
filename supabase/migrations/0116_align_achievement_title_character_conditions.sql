-- 実績報酬の文字は、元の実績とまったく同じ条件で解放する。
-- 例：10時間勉強の実績を達成 → その実績の文字も同時に受取可能。

alter table public.title_character_definitions drop constraint if exists title_character_definitions_condition_type_check;
alter table public.title_character_definitions add constraint title_character_definitions_condition_type_check
  check (condition_type in ('streak', 'study_minutes', 'workout_minutes', 'post_count', 'active_days', 'challenge_wins', 'habit_streak', 'subject_count'));

update public.title_character_definitions chars
set
  condition_type = case achievements.condition_type
    when 'consecutive_days' then 'streak'
    when 'habit_rate' then 'habit_streak'
    else achievements.condition_type
  end,
  threshold = achievements.condition_value,
  description = achievements.title || 'を達成する'
from public.achievement_title_character_rewards rewards
join public.achievement_definitions achievements on achievements.id = rewards.achievement_id
where chars.id = rewards.definition_id;

-- 五十音の通常判定も、実績と同じ種類の条件を理解できるようにする。
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
  select coalesce(consecutive_post_days, 0) into v_streak from public.profiles where id = v_user_id;
  select coalesce(sum(study_minutes), 0), coalesce(sum(workout_minutes), 0), count(*), count(distinct created_at::date)
    into v_study_minutes, v_workout_minutes, v_post_count, v_active_days
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
