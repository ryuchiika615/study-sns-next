alter table if exists posts
  add column if not exists updated_at timestamptz;

alter table if exists comments
  add column if not exists updated_at timestamptz;
