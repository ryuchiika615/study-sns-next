-- Performance indexes for common query patterns

-- notification_settings is queried by user_id in push routes + profile edit
create index if not exists idx_notification_settings_user_id on public.notification_settings(user_id);

-- push_subscriptions queried by user_id in all push routes
create index if not exists idx_push_subscriptions_user_id on public.push_subscriptions(user_id);

-- profiles queried by username in profile pages
create index if not exists idx_profiles_username on public.profiles(username);

-- post_reactions queried by post_id for reaction counts
create index if not exists idx_post_reactions_post_id on public.post_reactions(post_id);

-- notifications queried by sender_id for matching
create index if not exists idx_notifications_sender on public.notifications(sender_id);

-- Combined index for challenges status queries
create index if not exists idx_challenges_status_opponent on public.challenges(opponent_id, status);
