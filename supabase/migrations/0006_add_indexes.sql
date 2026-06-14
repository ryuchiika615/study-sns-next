-- パフォーマンス改善用インデックス
create index if not exists idx_posts_created_at on posts(created_at desc);
create index if not exists idx_posts_user_id on posts(user_id);
create index if not exists idx_follows_follower on follows(follower_id);
create index if not exists idx_follows_following on follows(following_id);
create index if not exists idx_notifications_recipient on notifications(recipient_id, created_at desc);
create index if not exists idx_likes_post_id on likes(post_id);
create index if not exists idx_comments_post_id on comments(post_id);
