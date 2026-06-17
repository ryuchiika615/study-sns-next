-- Add 'mention' to notification_type check constraint
alter table notifications drop constraint if exists notifications_notification_type_check;
alter table notifications add constraint notifications_notification_type_check
  check (notification_type in ('like','reply','follow','follow_post','gift','mention'));
