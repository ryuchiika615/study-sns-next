-- Add missing created_at column to follows table
alter table follows add column if not exists created_at timestamptz not null default now();
