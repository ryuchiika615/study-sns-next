-- Add challenge/challenge_complete back to notification_type check constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_notification_type_check
  CHECK (notification_type IN ('like','reply','follow','follow_post','gift','mention','admin_announcement','repost','comment_like','challenge','challenge_complete'));
