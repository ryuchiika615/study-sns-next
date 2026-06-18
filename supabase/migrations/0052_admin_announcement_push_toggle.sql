ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS push_admin_announcements boolean NOT NULL DEFAULT true;
