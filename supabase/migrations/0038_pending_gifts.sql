-- 1. Add 'gift' to notification_type check constraint
delete from notifications where notification_type = 'gift';

alter table notifications drop constraint if exists notifications_notification_type_check;
alter table notifications add constraint notifications_notification_type_check
  check (notification_type in ('like','reply','follow','follow_post','gift'));

-- 2. Pending gifts table (gifts waiting to be claimed by user)
create table if not exists pending_gifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  item_id uuid not null references gacha_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

alter table pending_gifts enable row level security;

create policy "pending_gifts_select" on pending_gifts
  for select using (auth.uid() = user_id);

create policy "pending_gifts_update" on pending_gifts
  for update using (auth.uid() = user_id);

create index idx_pending_gifts_user_id on pending_gifts(user_id);
