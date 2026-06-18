ALTER TABLE notification_settings
DROP COLUMN IF EXISTS sound_enabled,
DROP COLUMN IF EXISTS vibration_enabled;

ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS vibrate_like boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS vibrate_reply boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS vibrate_follow boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS vibrate_mention boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS vibrate_gift boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS vibrate_follow_post boolean NOT NULL DEFAULT true;
