-- Modify existing notification triggers to only notify when the sender is followed
-- and the follower has the corresponding notification setting enabled.

-- Like: only notify post author if they follow the liker with notify_likes enabled
create or replace function notify_on_like()
returns trigger as $$
begin
  insert into public.notifications (recipient_id, sender_id, post_id, notification_type)
  select p.user_id, new.user_id, new.post_id, 'like'
  from public.posts p
  join public.follows f
    on f.follower_id = p.user_id
   and f.following_id = new.user_id
   and f.notify_likes = true
  where p.id = new.post_id and p.user_id != new.user_id;
  return new;
end;
$$ language plpgsql security definer;

-- Comment: only notify post author if they follow the commenter with notify_comments enabled
create or replace function notify_on_comment()
returns trigger as $$
begin
  insert into public.notifications (recipient_id, sender_id, post_id, notification_type)
  select p.user_id, new.user_id, new.post_id, 'reply'
  from public.posts p
  join public.follows f
    on f.follower_id = p.user_id
   and f.following_id = new.user_id
   and f.notify_comments = true
  where p.id = new.post_id and p.user_id != new.user_id;
  return new;
end;
$$ language plpgsql security definer;
