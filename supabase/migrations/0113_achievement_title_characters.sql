-- 実績で「一文字」を解放し、好きな並びの自作称号を作る機能。
-- 完成称号やアイコンフレームとは別枠なので、既存アイテムの価値は下げない。

create table if not exists public.title_character_definitions (
  id text primary key,
  character text not null check (char_length(character) = 1),
  label text not null,
  description text not null,
  condition_type text not null check (condition_type in ('streak', 'study_minutes', 'workout_minutes', 'post_count', 'active_days', 'challenge_wins')),
  threshold integer not null check (threshold > 0),
  rarity text not null check (rarity in ('R', 'SR', 'SSR', 'UR', 'LR', 'XR')),
  sort_order integer not null
);

create table if not exists public.user_title_characters (
  user_id uuid not null references public.profiles(id) on delete cascade,
  definition_id text not null references public.title_character_definitions(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, definition_id)
);

alter table public.title_character_definitions enable row level security;
alter table public.user_title_characters enable row level security;
drop policy if exists "title_character_definitions_read" on public.title_character_definitions;
create policy "title_character_definitions_read" on public.title_character_definitions for select using (true);
drop policy if exists "user_title_characters_read_own" on public.user_title_characters;
create policy "user_title_characters_read_own" on public.user_title_characters for select using (auth.uid() = user_id);

insert into public.title_character_definitions (id, character, label, description, condition_type, threshold, rarity, sort_order) values
  ('streak_10_shi', 'し', '継続の「し」', '10日連続で記録する', 'streak', 10, 'R', 10),
  ('study_20_yu', 'ゅ', '積み上げの「ゅ」', '合計20時間学習する', 'study_minutes', 1200, 'R', 20),
  ('active_30_u', 'う', '日々の「う」', '30日分の活動記録を残す', 'active_days', 30, 'SR', 30),
  ('study_50_ga', '学', '知識の「学」', '合計50時間学習する', 'study_minutes', 3000, 'SR', 40),
  ('post_40_ku', '究', '探求の「究」', '40件投稿する', 'post_count', 40, 'SR', 50),
  ('study_100_sei', '星', '到達の「星」', '合計100時間学習する', 'study_minutes', 6000, 'SSR', 60),
  ('streak_21_ha', '覇', '連続の「覇」', '21日連続で記録する', 'streak', 21, 'SSR', 70),
  ('workout_20_zero', '零', '鍛錬の「零」', '合計20時間筋トレする', 'workout_minutes', 1200, 'SSR', 80),
  ('active_100_toki', '時', '時間の「時」', '100日分の活動記録を残す', 'active_days', 100, 'UR', 90),
  ('study_200_ou', '王', '到達の「王」', '合計200時間学習する', 'study_minutes', 12000, 'UR', 100),
  ('streak_60_ryu', '龍', '不屈の「龍」', '60日連続で記録する', 'streak', 60, 'LR', 110),
  ('challenge_3_ten', '天', '勝負の「天」', '対決で3勝する', 'challenge_wins', 3, 'LR', 120),
  ('study_500_shin', '神', '伝説の「神」', '合計500時間学習する', 'study_minutes', 30000, 'XR', 130),
  ('streak_100_sora', '空', '天空の「空」', '100日連続で記録する', 'streak', 100, 'XR', 140),
  ('study_1000_infinity', '∞', '永続の「∞」', '合計1000時間学習する', 'study_minutes', 60000, 'XR', 150)
on conflict (id) do update set
  character = excluded.character, label = excluded.label, description = excluded.description,
  condition_type = excluded.condition_type, threshold = excluded.threshold, rarity = excluded.rarity, sort_order = excluded.sort_order;

create or replace function public.sync_title_characters()
returns json language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_streak integer := 0;
  v_study_minutes integer := 0;
  v_workout_minutes integer := 0;
  v_post_count integer := 0;
  v_active_days integer := 0;
  v_challenge_wins integer := 0;
  v_definition record;
  v_reached boolean;
  v_new jsonb := '[]'::jsonb;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  select coalesce(consecutive_post_days, 0) into v_streak from public.profiles where id = v_user_id;
  select coalesce(sum(study_minutes), 0), coalesce(sum(workout_minutes), 0), count(*), count(distinct created_at::date)
    into v_study_minutes, v_workout_minutes, v_post_count, v_active_days
    from public.posts where user_id = v_user_id;
  select count(*) into v_challenge_wins from public.challenges where winner_id = v_user_id and status = 'completed';

  for v_definition in select * from public.title_character_definitions order by sort_order loop
    v_reached := case v_definition.condition_type
      when 'streak' then v_streak >= v_definition.threshold
      when 'study_minutes' then v_study_minutes >= v_definition.threshold
      when 'workout_minutes' then v_workout_minutes >= v_definition.threshold
      when 'post_count' then v_post_count >= v_definition.threshold
      when 'active_days' then v_active_days >= v_definition.threshold
      when 'challenge_wins' then v_challenge_wins >= v_definition.threshold
      else false
    end;
    if v_reached and not exists (
      select 1 from public.user_title_characters u where u.user_id = v_user_id and u.definition_id = v_definition.id
    ) then
      insert into public.user_title_characters (user_id, definition_id) values (v_user_id, v_definition.id);
      v_new := v_new || jsonb_build_array(jsonb_build_object('id', v_definition.id, 'character', v_definition.character, 'label', v_definition.label, 'rarity', v_definition.rarity));
    end if;
  end loop;
  return json_build_object('new_characters', v_new);
end;
$$;

create or replace function public.create_custom_title(p_definition_ids text[])
returns json language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_name text;
  v_rarity text;
  v_item record;
  v_count integer;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if coalesce(array_length(p_definition_ids, 1), 0) < 2 or array_length(p_definition_ids, 1) > 8 then
    raise exception '文字は2〜8個選んでください。';
  end if;
  if (select count(distinct x) from unnest(p_definition_ids) as x) <> array_length(p_definition_ids, 1) then
    raise exception '同じ文字は1回だけ選べます。';
  end if;
  select count(*) into v_count from public.user_title_characters u
    where u.user_id = v_user_id and u.definition_id = any(p_definition_ids);
  if v_count <> array_length(p_definition_ids, 1) then raise exception '未解放の文字は使えません。'; end if;

  select string_agg(d.character, '' order by array_position(p_definition_ids, d.id)),
    case max(case d.rarity when 'R' then 2 when 'SR' then 3 when 'SSR' then 4 when 'UR' then 5 when 'LR' then 6 when 'XR' then 7 else 1 end)
      when 7 then 'XR' when 6 then 'LR' when 5 then 'UR' when 4 then 'SSR' when 3 then 'SR' else 'R' end
    into v_name, v_rarity
  from public.title_character_definitions d where d.id = any(p_definition_ids);

  select * into v_item from public.gacha_items where name = '自作：' || v_name and category = 'title' limit 1;
  if v_item is null then
    insert into public.gacha_items (name, rarity, category) values ('自作：' || v_name, v_rarity, 'title') returning * into v_item;
  end if;
  insert into public.user_items (user_id, item_id) values (v_user_id, v_item.id) on conflict do nothing;
  update public.profiles set current_title_id = v_item.id where id = v_user_id;
  return json_build_object('item', row_to_json(v_item));
end;
$$;
