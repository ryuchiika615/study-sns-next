ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS sound_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS vibration_enabled boolean NOT NULL DEFAULT true;
