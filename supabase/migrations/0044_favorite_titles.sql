ALTER TABLE user_items ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;
