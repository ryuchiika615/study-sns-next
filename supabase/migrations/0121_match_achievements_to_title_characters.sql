-- 通常実績を称号文字コレクションと同じ数まで増やす。
-- すべての文字に対応する実績を1つ割り当て、達成時には通常報酬と称号文字の両方を受け取れる。

alter table public.achievement_definitions drop constraint if exists achievement_definitions_condition_type_check;
alter table public.achievement_definitions add constraint achievement_definitions_condition_type_check check (
  condition_type in ('study_minutes', 'workout_minutes', 'active_days', 'consecutive_days', 'post_count', 'habit_rate', 'challenge_wins', 'subject_count', 'total_pomodoro', 'combined')
);

with unassigned_characters as (
  select chars.*, row_number() over (order by chars.sort_order, chars.id) as item_number
  from public.title_character_definitions chars
  where not exists (
    select 1 from public.achievement_title_character_rewards rewards
    where rewards.definition_id = chars.id
  )
), created_achievements as (
  insert into public.achievement_definitions (
    id, title, description, icon, category, condition_type, condition_value, reward_type, reward_value, sort_order
  )
  select
    'character_achievement_' || id,
    case condition_type
      when 'study_minutes' then '学びの文字「' || character || '」'
      when 'workout_minutes' then '鍛錬の文字「' || character || '」'
      when 'streak' then '継続の文字「' || character || '」'
      when 'post_count' then '発信の文字「' || character || '」'
      when 'active_days' then '活動の文字「' || character || '」'
      when 'challenge_wins' then '勝負の文字「' || character || '」'
      else '実績文字「' || character || '」'
    end,
    description,
    case condition_type
      when 'study_minutes' then '📚'
      when 'workout_minutes' then '🏋️'
      when 'streak' then '🔥'
      when 'post_count' then '✍️'
      when 'active_days' then '📅'
      when 'challenge_wins' then '⚔️'
      else '✨'
    end,
    case condition_type
      when 'study_minutes' then 'study_time'
      when 'streak' then 'streak'
      when 'post_count' then 'posts'
      when 'challenge_wins' then 'challenges'
      else 'special'
    end,
    case when condition_type = 'streak' then 'consecutive_days' else condition_type end,
    threshold,
    'points',
    case rarity
      when 'R' then 50 when 'SR' then 100 when 'SSR' then 200
      when 'UR' then 350 when 'LR' then 500 else 800
    end,
    100 + item_number
  from unassigned_characters
  on conflict (id) do update set
    title = excluded.title,
    description = excluded.description,
    icon = excluded.icon,
    category = excluded.category,
    condition_type = excluded.condition_type,
    condition_value = excluded.condition_value,
    reward_value = excluded.reward_value,
    sort_order = excluded.sort_order
  returning id
)
insert into public.achievement_title_character_rewards (achievement_id, definition_id)
select 'character_achievement_' || chars.id, chars.id
from public.title_character_definitions chars
join created_achievements created on created.id = 'character_achievement_' || chars.id
on conflict (achievement_id) do update set definition_id = excluded.definition_id;

-- すでに達成済みの新実績にも、文字受取待ちを用意する。
insert into public.user_achievement_title_rewards (user_id, achievement_id, definition_id)
select achievements.user_id, achievements.achievement_id, rewards.definition_id
from public.user_achievements achievements
join public.achievement_title_character_rewards rewards on rewards.achievement_id = achievements.achievement_id
where achievements.earned_at is not null
on conflict (user_id, achievement_id) do nothing;
