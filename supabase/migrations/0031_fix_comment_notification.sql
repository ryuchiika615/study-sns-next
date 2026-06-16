-- 1. Drop old comment notification trigger (references deleted notify_comments column)
drop trigger if exists trg_notify_on_comment on public.comments;
drop function if exists notify_on_comment() cascade;

-- 2. New comment notification: notify post author when someone comments
--    Only notifies if the author follows the commenter (same pattern as process_like)
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
  ) into v_should_notify;

  if v_should_notify then
    insert into notifications (recipient_id, sender_id, post_id, notification_type)
    values (v_author_id, new.user_id, new.post_id, 'reply');
  end if;

  return new;
end;
$$;

create trigger process_comment_trigger
  after insert on public.comments
  for each row execute function process_comment();

