-- 1. Drop follow_like trigger and function
drop trigger if exists trg_notify_followers_on_like on public.likes;
drop function if exists notify_followers_on_like() cascade;

-- 2. Drop follow_comment trigger and function
drop trigger if exists trg_notify_followers_on_comment on public.comments;
drop function if exists notify_followers_on_comment() cascade;

-- 3. Remove legacy notification rows before updating constraint
delete from notifications where notification_type in ('follow_like', 'follow_comment');

-- 4. Update notification_type check constraint (remove follow_like, follow_comment)
alter table notifications drop constraint if exists notifications_notification_type_check;
alter table notifications add constraint notifications_notification_type_check
  check (notification_type in ('like','reply','follow','follow_post'));

-- 5. Drop old comment notification trigger (references notify_comments column)
drop trigger if exists trg_notify_on_comment on public.comments;
drop function if exists notify_on_comment() cascade;

-- 6. Remove unused columns from follows
alter table follows drop column if exists notify_comments;
alter table follows drop column if exists notify_likes;

-- 7. Fix process_like: notify post author when the AUTHOR follows the LIKER (not vice versa)
--    The old logic had follower_id/liking_id backwards for the follow check.
create or replace function process_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_author_id uuid;
  v_should_notify boolean;
begin
  if new.user_id = (select user_id from posts where id = new.post_id) then
    return new;
  end if;

  select user_id into v_author_id from posts where id = new.post_id;

  insert into like_rewards (liker_id, post_id)
  values (new.user_id, new.post_id)
  on conflict do nothing;

  if found then
    update profiles set exchange_points = exchange_points + 10
    where id = v_author_id;

    select exists(
      select 1 from follows
      where follower_id = v_author_id
        and following_id = new.user_id
    ) into v_should_notify;

    if v_should_notify then
      insert into notifications (recipient_id, sender_id, post_id, notification_type)
      values (v_author_id, new.user_id, new.post_id, 'like');
    end if;
  end if;

  return new;
end;
$$;

