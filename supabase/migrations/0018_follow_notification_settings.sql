-- Follow notification settings
-- Users can choose to be notified when someone they follow posts, likes, or comments

-- 1. Add notification preference columns to follows table
alter table follows add column if not exists notify_posts boolean not null default true;
alter table follows add column if not exists notify_likes boolean not null default true;
alter table follows add column if not exists notify_comments boolean not null default true;

-- 2. Update notification_type check constraint to include follow activity types
alter table notifications drop constraint if exists notifications_notification_type_check;
alter table notifications add constraint notifications_notification_type_check
  check (notification_type in ('like','reply','follow','follow_post','follow_like','follow_comment'));

-- 3. Trigger: notify followers when a user they follow creates a post
create or replace function notify_followers_on_post()
returns trigger as $$
begin
  insert into public.notifications (recipient_id, sender_id, post_id, notification_type)
  select f.follower_id, new.user_id, new.id, 'follow_post'
  from public.follows f
  where f.following_id = new.user_id
    and f.notify_posts = true
    and f.follower_id != new.user_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_followers_on_post on public.posts;
create trigger trg_notify_followers_on_post
  after insert on public.posts
  for each row execute function notify_followers_on_post();

-- 4. Trigger: notify followers when a user they follow likes a post
create or replace function notify_followers_on_like()
returns trigger as $$
begin
  insert into public.notifications (recipient_id, sender_id, post_id, notification_type)
  select f.follower_id, new.user_id, new.post_id, 'follow_like'
  from public.follows f
  where f.following_id = new.user_id
    and f.notify_likes = true
    and f.follower_id != new.user_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_followers_on_like on public.likes;
create trigger trg_notify_followers_on_like
  after insert on public.likes
  for each row execute function notify_followers_on_like();

-- 5. Trigger: notify followers when a user they follow comments on a post
create or replace function notify_followers_on_comment()
returns trigger as $$
begin
  insert into public.notifications (recipient_id, sender_id, post_id, notification_type)
  select f.follower_id, new.user_id, new.post_id, 'follow_comment'
  from public.follows f
  where f.following_id = new.user_id
    and f.notify_comments = true
    and f.follower_id != new.user_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_followers_on_comment on public.comments;
create trigger trg_notify_followers_on_comment
  after insert on public.comments
  for each row execute function notify_followers_on_comment();
