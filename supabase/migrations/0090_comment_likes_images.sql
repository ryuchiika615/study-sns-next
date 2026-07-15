-- 1. Increase post content limit (was 140)
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_content_check;
ALTER TABLE posts ADD CONSTRAINT posts_content_check CHECK (char_length(content) <= 2000);

-- 2. Increase comment text limit (was 100)
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_text_check;
ALTER TABLE comments ADD CONSTRAINT comments_text_check CHECK (char_length(text) <= 500);

-- 3. Add image_urls to comments
ALTER TABLE comments ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';

-- 4. Create comment_likes table
CREATE TABLE IF NOT EXISTS comment_likes (
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, comment_id)
);
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);

-- 5. RLS for comment_likes
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comment_likes_select" ON comment_likes FOR SELECT USING (true);
CREATE POLICY "comment_likes_insert" ON comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comment_likes_delete" ON comment_likes FOR DELETE USING (auth.uid() = user_id);

-- 6. Add comment_like to notification_type check
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_notification_type_check
  CHECK (notification_type IN ('like','reply','follow','follow_post','gift','mention','admin_announcement','repost','comment_like'));
