-- Add weekly AI report cache columns to profiles
alter table if exists profiles
  add column if not exists weekly_ai_week_start date,
  add column if not exists weekly_ai_comment text;
