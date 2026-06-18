-- 1. Add stake column
alter table public.challenges add column if not exists stake integer not null default 0;

-- 2. Update completion trigger to transfer points
create or replace function check_challenge_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge record;
  v_user_total integer;
  v_loser_id uuid;
begin
  for v_challenge in (
    select id, challenger_id, opponent_id, target_value, accepted_at, stake
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
        if new.user_id = v_challenge.challenger_id then
          v_loser_id := v_challenge.opponent_id;
        else
          v_loser_id := v_challenge.challenger_id;
        end if;

        if v_challenge.stake > 0 then
          update profiles
          set exchange_points = exchange_points - v_challenge.stake
          where id = v_loser_id;

          update profiles
          set exchange_points = exchange_points + v_challenge.stake
          where id = new.user_id;
        end if;

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
