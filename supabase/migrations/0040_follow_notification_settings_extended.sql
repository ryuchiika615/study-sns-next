-- 1. Add notification type columns back
alter table follows add column if not exists notify_likes boolean not null default true;
alter table follows add column if not exists notify_comments boolean not null default true;

-- 2. Update process_like to check notify_likes
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
        and notify_likes = true
    ) into v_should_notify;

    if v_should_notify then
      insert into notifications (recipient_id, sender_id, post_id, notification_type)
      values (v_author_id, new.user_id, new.post_id, 'like');
    end if;
  end if;

  return new;
end;
$$;

-- 3. Update process_comment to check notify_comments
create or replace function process_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_author_id uuid;
  v_should_notify boolean;
begin
  select user_id into v_author_id from posts where id = new.post_id;
  if v_author_id = new.user_id then
    return new;
  end if;

  select exists(
    select 1 from follows
    where follower_id = v_author_id
      and following_id = new.user_id
      and notify_comments = true
  ) into v_should_notify;

  if v_should_notify then
    insert into notifications (recipient_id, sender_id, post_id, notification_type)
    values (v_author_id, new.user_id, new.post_id, 'reply');
  end if;

  return new;
end;
$$;
