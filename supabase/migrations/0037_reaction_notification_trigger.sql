-- Add trigger to create notifications when someone reacts to a post
-- Notifies post author only if they follow the reactor (same pattern as process_like/process_comment)

create or replace function notify_on_reaction()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_author_id uuid;
  v_should_notify boolean;
begin
  select user_id into v_author_id from posts where id = new.post_id;
  if v_author_id = new.user_id then
    return new;  -- self-reaction, skip
  end if;

  -- Only notify if the POST AUTHOR follows the REACTOR
  select exists(
    select 1 from follows
    where follower_id = v_author_id
      and following_id = new.user_id
  ) into v_should_notify;

  if v_should_notify then
    insert into notifications (recipient_id, sender_id, post_id, notification_type)
    values (v_author_id, new.user_id, new.post_id, 'like');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_on_reaction on public.post_reactions;
create trigger trg_notify_on_reaction
  after insert on public.post_reactions
  for each row execute function notify_on_reaction();
