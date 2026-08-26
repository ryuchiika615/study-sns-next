-- 既存の実績にも五十音の称号文字を追加する。
-- 従来のポイント・完成称号はそのまま残し、文字は別の追加報酬として受け取れるようにする。

create table if not exists public.achievement_title_character_rewards (
  achievement_id text primary key references public.achievement_definitions(id) on delete cascade,
  definition_id text not null unique references public.title_character_definitions(id) on delete cascade
);

create table if not exists public.user_achievement_title_rewards (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null references public.achievement_definitions(id) on delete cascade,
  definition_id text not null references public.title_character_definitions(id) on delete cascade,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  primary key (user_id, achievement_id)
);

alter table public.user_achievement_title_rewards enable row level security;
drop policy if exists "users_read_own_achievement_title_rewards" on public.user_achievement_title_rewards;
create policy "users_read_own_achievement_title_rewards"
  on public.user_achievement_title_rewards for select using (auth.uid() = user_id);

-- 既存実績ごとに、異なる五十音1文字を追加報酬として割り当てる。
insert into public.achievement_title_character_rewards (achievement_id, definition_id) values
  ('study_10h', 'kana_16_i'), ('study_50h', 'kana_17_re'), ('study_100h', 'kana_18_so'),
  ('study_500h', 'kana_19_ta'), ('study_1000h', 'kana_20_mu'), ('streak_3', 'kana_21_yo'),
  ('streak_7', 'kana_22_ha'), ('streak_14', 'kana_23_na'), ('streak_30', 'kana_24_chi'),
  ('streak_365', 'kana_25_wo'), ('posts_10', 'kana_26_ka'), ('posts_50', 'kana_27_no'),
  ('posts_100', 'kana_28_u'), ('posts_500', 'kana_29_ma'), ('habits_7', 'kana_30_se'),
  ('habits_30', 'kana_31_hi'), ('challenge_1', 'kana_32_ra'), ('challenge_10', 'kana_33_te'),
  ('challenge_50', 'kana_34_ko'), ('subjects_5', 'kana_35_ne'), ('subjects_10', 'kana_36_fu')
on conflict (achievement_id) do update set definition_id = excluded.definition_id;

-- 通知に「実績」を追加する。既存の通知種別も残す。
alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check check (
  notification_type in (
    'like', 'reply', 'follow', 'follow_post', 'gift', 'mention', 'admin_announcement',
    'repost', 'comment_like', 'challenge', 'challenge_complete', 'group_post', 'group_rank',
    'group_challenge', 'activity_cheer', 'achievement'
  )
);

-- 実績達成時に、文字の受取待ちと通知を自動で作る。
create or replace function public.grant_achievement_title_character()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_definition_id text;
  v_character text;
begin
  if new.earned_at is null or (tg_op = 'UPDATE' and old.earned_at is not null) then return new; end if;
  select definition_id into v_definition_id
    from public.achievement_title_character_rewards where achievement_id = new.achievement_id;
  if v_definition_id is null then return new; end if;

  insert into public.user_achievement_title_rewards (user_id, achievement_id, definition_id)
    values (new.user_id, new.achievement_id, v_definition_id)
  on conflict (user_id, achievement_id) do nothing;

  if found then
    select character into v_character from public.title_character_definitions where id = v_definition_id;
    insert into public.notifications (recipient_id, sender_id, notification_type, message)
      values (new.user_id, new.user_id, 'achievement', '実績報酬：称号文字「' || coalesce(v_character, '？') || '」を受け取れます');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_grant_achievement_title_character on public.user_achievements;
create trigger trg_grant_achievement_title_character
  after insert or update of earned_at on public.user_achievements
  for each row execute function public.grant_achievement_title_character();

-- すでに達成済みの実績にも、今から受け取れる文字を用意する。
insert into public.user_achievement_title_rewards (user_id, achievement_id, definition_id)
select ua.user_id, ua.achievement_id, map.definition_id
from public.user_achievements ua
join public.achievement_title_character_rewards map on map.achievement_id = ua.achievement_id
where ua.earned_at is not null
on conflict (user_id, achievement_id) do nothing;

insert into public.notifications (recipient_id, sender_id, notification_type, message)
select reward.user_id, reward.user_id, 'achievement', '実績報酬：称号文字「' || chars.character || '」を受け取れます'
from public.user_achievement_title_rewards reward
join public.title_character_definitions chars on chars.id = reward.definition_id
where reward.claimed_at is null
  and not exists (
    select 1 from public.notifications n
    where n.recipient_id = reward.user_id
      and n.notification_type = 'achievement'
      and n.message = '実績報酬：称号文字「' || chars.character || '」を受け取れます'
  );

create or replace function public.claim_achievement_title_character(p_achievement_id text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_definition_id text;
  v_character text;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  select definition_id into v_definition_id
    from public.user_achievement_title_rewards
    where user_id = v_user_id and achievement_id = p_achievement_id and claimed_at is null;
  if v_definition_id is null then raise exception 'この称号文字はすでに受取済みです。'; end if;

  insert into public.user_title_characters (user_id, definition_id)
    values (v_user_id, v_definition_id) on conflict do nothing;
  update public.user_achievement_title_rewards set claimed_at = now()
    where user_id = v_user_id and achievement_id = p_achievement_id;
  select character into v_character from public.title_character_definitions where id = v_definition_id;
  return json_build_object('character', v_character, 'definition_id', v_definition_id);
end;
$$;

grant execute on function public.claim_achievement_title_character(text) to authenticated;
