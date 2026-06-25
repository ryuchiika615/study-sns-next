alter table if exists public.user_feedback
  add column if not exists resolved boolean not null default false;
