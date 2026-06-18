-- 0. Add challenge_complete to notification_type check
alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check
  check (notification_type in ('like','reply','follow','follow_post','gift','mention','admin_announcement','repost','challenge','challenge_complete'));

-- 1. Trigger function: check if a post completes any active challenge
create or replace function check_challenge_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge record;
  v_user_total integer;
begin
  for v_challenge in (
    select id, challenger_id, opponent_id, target_value, accepted_at
    from challenges
    where status = 'accepted'
      and target_value > 0
      and (challenger_id = new.user_id or opponent_id = new.user_id)
  ) loop
    select coalesce(sum(study_minutes), 0) into v_user_total
    from posts
    where user_id = new.user_id
      and created_at >= v_challenge.accepted_at;

    if v_user_total >= v_challenge.target_value then
      update challenges
      set status = 'completed',
          winner_id = new.user_id,
          completed_at = now()
      where id = v_challenge.id
        and status = 'accepted';

      if found then
        insert into notifications (recipient_id, sender_id, notification_type)
        values
          (v_challenge.challenger_id, new.user_id, 'challenge_complete'),
          (v_challenge.opponent_id, new.user_id, 'challenge_complete');
      end if;
    end if;
  end loop;

  return new;
end;
$$;

create trigger trg_check_challenges_after_post
  after insert on public.posts
  for each row
  execute function check_challenge_completion();
