-- Add per-habit notification settings
alter table habits add column if not exists notify_enabled boolean not null default false;
alter table habits add column if not exists notify_time time not null default '21:00';
