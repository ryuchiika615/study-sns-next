-- Add missing created_at column to likes table
alter table likes add column if not exists created_at timestamptz not null default now();
