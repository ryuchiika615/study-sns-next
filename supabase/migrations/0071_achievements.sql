-- Achievement definitions + user progress tracking
create table if not exists achievement_definitions (
  id text primary key,
  title text not null,
  description text not null,
  icon text not null,
  category text not null check (category in ('study_time', 'streak', 'posts', 'habits', 'challenges', 'subjects', 'special')),
  condition_type text not null check (condition_type in ('study_minutes', 'consecutive_days', 'post_count', 'habit_rate', 'challenge_wins', 'subject_count', 'total_pomodoro', 'combined')),
  condition_value integer not null,
  reward_type text not null default 'points' check (reward_type in ('points', 'title', 'icon')),
  reward_value integer not null default 0,
  sort_order integer not null default 0
);

alter table achievement_definitions enable row level security;
create policy "Anyone can read achievement_definitions"
  on achievement_definitions for select using (true);

create table if not exists user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null references achievement_definitions(id) on delete cascade,
  progress integer not null default 0,
  earned_at timestamptz,
  claimed boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table user_achievements enable row level security;

create policy "Users can read own achievements"
  on user_achievements for select
  using (auth.uid() = user_id);

create policy "Users can insert own achievements"
  on user_achievements for insert
  with check (auth.uid() = user_id);

create policy "Users can update own achievements"
  on user_achievements for update
  using (auth.uid() = user_id);

create index if not exists user_achievements_user_id_idx on user_achievements(user_id);

-- Seed achievement definitions
insert into achievement_definitions (id, title, description, icon, category, condition_type, condition_value, reward_type, reward_value, sort_order) values
  ('study_10h', '勉強初心者', '合計勉強時間が10時間に到達', '📚', 'study_time', 'study_minutes', 600, 'points', 50, 1),
  ('study_50h', '勉強習慣', '合計勉強時間が50時間に到達', '📖', 'study_time', 'study_minutes', 3000, 'points', 200, 2),
  ('study_100h', '勉強マスター', '合計勉強時間が100時間に到達', '🎓', 'study_time', 'study_minutes', 6000, 'points', 500, 3),
  ('study_500h', '知識の探求者', '合計勉強時間が500時間に到達', '👑', 'study_time', 'study_minutes', 30000, 'title', 1, 4),
  ('study_1000h', '至高の学習者', '合計勉強時間が1000時間に到達', '💎', 'study_time', 'study_minutes', 60000, 'title', 2, 5),
  ('streak_3', '連続勉強初級', '3日連続で勉強', '🔥', 'streak', 'consecutive_days', 3, 'points', 30, 6),
  ('streak_7', '連続勉強中級', '7日連続で勉強', '🔥', 'streak', 'consecutive_days', 7, 'points', 100, 7),
  ('streak_14', '連続勉強上級', '14日連続で勉強', '🔥', 'streak', 'consecutive_days', 14, 'points', 300, 8),
  ('streak_30', '連続勉強達人', '30日連続で勉強', '🔥', 'streak', 'consecutive_days', 30, 'title', 3, 9),
  ('streak_365', '年間無欠', '365日連続で勉強', '🌟', 'streak', 'consecutive_days', 365, 'title', 4, 10),
  ('posts_10', 'ポスター見習い', '10件の投稿', '📝', 'posts', 'post_count', 10, 'points', 20, 11),
  ('posts_50', 'アクティブポスター', '50件の投稿', '✍️', 'posts', 'post_count', 50, 'points', 100, 12),
  ('posts_100', '投稿マスター', '100件の投稿', '🏆', 'posts', 'post_count', 100, 'points', 300, 13),
  ('posts_500', '投稿の達人', '500件の投稿', '👑', 'posts', 'post_count', 500, 'title', 5, 14),
  ('habits_7', '習慣化初級', '全習慣を7日連続で達成', '✅', 'habits', 'habit_rate', 7, 'points', 100, 15),
  ('habits_30', '習慣化マスター', '全習慣を30日連続で達成', '⭐', 'habits', 'habit_rate', 30, 'title', 6, 16),
  ('challenge_1', '挑戦者', 'チャレンジで初勝利', '⚔️', 'challenges', 'challenge_wins', 1, 'points', 50, 17),
  ('challenge_10', 'バトルマスター', 'チャレンジで10勝', '🏅', 'challenges', 'challenge_wins', 10, 'title', 7, 18),
  ('challenge_50', '無敗の王者', 'チャレンジで50勝', '👑', 'challenges', 'challenge_wins', 50, 'title', 8, 19),
  ('subjects_5', 'マルチラーナー', '5種類以上の科目を勉強', '🎨', 'subjects', 'subject_count', 5, 'points', 100, 20),
  ('subjects_10', 'オールラウンダー', '10種類以上の科目を勉強', '🌈', 'subjects', 'subject_count', 10, 'title', 9, 21)
on conflict (id) do nothing;

-- RPC to count distinct subjects for a user
create or replace function get_distinct_subjects(p_user_id uuid)
returns integer
language sql
security definer
as $$
  select count(distinct subject)::integer from posts where user_id = p_user_id and subject != '';
$$;
