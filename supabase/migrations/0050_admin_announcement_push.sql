ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS vibrate_admin_announcement boolean NOT NULL DEFAULT true;

alter table notifications drop constraint if exists notifications_notification_type_check;
alter table notifications add constraint notifications_notification_type_check
  check (notification_type in ('like','reply','follow','follow_post','gift','mention','admin_announcement'));
