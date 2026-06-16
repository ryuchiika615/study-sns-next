-- Fix: Japanese error message, allow discarding refined items (0 points)

drop function if exists combine_items(integer, integer, text);
drop function if exists combine_items(p_item_id_a integer, p_item_id_b integer, p_order text);
create or replace function combine_items(
  p_item_id_a uuid, p_item_id_b uuid, p_order text default 'normal'
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid; v_item_a record; v_item_b record; v_rarity_val integer;
  v_new_rarity text; v_left text; v_right text; v_full_title text; v_new_item record;
begin
  v_user_id := auth.uid(); if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_item_id_a = p_item_id_b then raise exception '同じアイテムは組み合わせられません'; end if;
  select g.* into v_item_a from gacha_items g join user_items ui on ui.item_id = g.id where g.id = p_item_id_a and ui.user_id = v_user_id;
  select g.* into v_item_b from gacha_items g join user_items ui on ui.item_id = g.id where g.id = p_item_id_b and ui.user_id = v_user_id;
  if v_item_a is null or v_item_b is null then raise exception 'アイテムが見つかりません'; end if;
  v_rarity_val := greatest(case v_item_a.rarity when 'N' then 1 when 'R' then 2 when 'SR' then 3 when 'SSR' then 4 when 'UR' then 5 when 'LR' then 6 else 1 end, case v_item_b.rarity when 'N' then 1 when 'R' then 2 when 'SR' then 3 when 'SSR' then 4 when 'UR' then 5 when 'LR' then 6 else 1 end);
  v_new_rarity := case v_rarity_val when 1 then 'N' when 2 then 'R' when 3 then 'SR' when 4 then 'SSR' when 5 then 'UR' when 6 then 'LR' end;
  if p_order = 'reverse' then v_left := v_item_b.name; v_right := v_item_a.name; else v_left := v_item_a.name; v_right := v_item_b.name; end if;
  v_full_title := left('精錬:' || v_left || v_right, 95);
  select * into v_new_item from gacha_items where name = v_full_title limit 1;
  if v_new_item is null then insert into gacha_items (name, rarity, category) values (v_full_title, v_new_rarity, 'title') returning * into v_new_item; end if;
  insert into user_items (user_id, item_id) values (v_user_id, v_new_item.id) on conflict (user_id, item_id) do nothing;
  update profiles set current_title_id = v_new_item.id where id = v_user_id;
  return json_build_object('item', row_to_json(v_new_item));
end; $$;

-- Allow discarding refined items (0 points)
drop function if exists sell_items(integer[], text);
create or replace function sell_items(
  p_item_ids uuid[], p_max_rarity text default null
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid; v_profile record; v_ids_to_delete uuid[] := '{}';
  v_total_points integer := 0; v_rec record; v_rarity_val integer;
  v_sell_val integer; v_max_val integer; v_is_refined boolean;
begin
  v_user_id := auth.uid(); if v_user_id is null then raise exception 'Not authenticated'; end if;
  select * into v_profile from profiles where id = v_user_id;
  if v_profile is null then raise exception 'Profile not found'; end if;
  if p_max_rarity is not null then
    v_max_val := case p_max_rarity when 'N' then 1 when 'R' then 2 when 'SR' then 3 when 'SSR' then 4 when 'UR' then 5 when 'LR' then 6 else 0 end;
    for v_rec in select g.id, g.name, g.rarity from user_items ui join gacha_items g on g.id = ui.item_id where ui.user_id = v_user_id loop
      v_rarity_val := case v_rec.rarity when 'N' then 1 when 'R' then 2 when 'SR' then 3 when 'SSR' then 4 when 'UR' then 5 when 'LR' then 6 else 1 end;
      v_is_refined := v_rec.name like '精錬:%' or v_rec.name like '邊ｾ骭ｬ:%';
      if v_rarity_val <= v_max_val and v_rec.id != v_profile.current_title_id and v_rec.id != v_profile.current_avatar_id then
        v_ids_to_delete := array_append(v_ids_to_delete, v_rec.id);
        if not v_is_refined then
          v_sell_val := case v_rec.rarity when 'N' then 1 when 'R' then 4 when 'SR' then 15 when 'SSR' then 60 when 'UR' then 180 when 'LR' then 650 else 0 end;
          v_total_points := v_total_points + v_sell_val;
        end if;
      end if;
    end loop;
  elsif array_length(p_item_ids, 1) > 0 then
    for v_rec in select g.id, g.name, g.rarity from user_items ui join gacha_items g on g.id = ui.item_id where ui.user_id = v_user_id and ui.item_id = any(p_item_ids) loop
      v_is_refined := v_rec.name like '精錬:%' or v_rec.name like '邊ｾ骭ｬ:%';
      if v_rec.id != v_profile.current_title_id and v_rec.id != v_profile.current_avatar_id then
        v_ids_to_delete := array_append(v_ids_to_delete, v_rec.id);
        if not v_is_refined then
          v_sell_val := case v_rec.rarity when 'N' then 1 when 'R' then 4 when 'SR' then 15 when 'SSR' then 60 when 'UR' then 180 when 'LR' then 650 else 0 end;
          v_total_points := v_total_points + v_sell_val;
        end if;
      end if;
    end loop;
  end if;
  if array_length(v_ids_to_delete, 1) > 0 then
    delete from user_items where user_id = v_user_id and item_id = any(v_ids_to_delete);
    update profiles set exchange_points = exchange_points + v_total_points where id = v_user_id;
  end if;
  return json_build_object('sold', v_total_points, 'remaining_points', coalesce(v_profile.exchange_points, 0) + v_total_points);
end;
$$;

-- buy_item stays the same
drop function if exists buy_item(text, text, text);
create or replace function buy_item(
  p_rarity text, p_item_type text, p_item_name text
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid; v_profile record; v_cost integer; v_item record;
begin
  v_user_id := auth.uid(); if v_user_id is null then raise exception 'Not authenticated'; end if;
  v_cost := case p_rarity when 'N' then 5 when 'R' then 15 when 'SR' then 60 when 'SSR' then 240 when 'UR' then 720 when 'LR' then 2600 else null end;
  if v_cost is null then raise exception 'Invalid rarity'; end if;
  select * into v_profile from profiles where id = v_user_id;
  if v_profile is null or v_profile.exchange_points < v_cost then raise exception 'Insufficient points'; end if;
  select * into v_item from gacha_items where name = p_item_name limit 1;
  if v_item is null then insert into gacha_items (name, rarity, category) values (p_item_name, p_rarity, p_item_type) returning * into v_item; end if;
  insert into user_items (user_id, item_id) values (v_user_id, v_item.id) on conflict (user_id, item_id) do nothing;
  update profiles set exchange_points = exchange_points - v_cost where id = v_user_id;
  return json_build_object('item', row_to_json(v_item), 'remaining_points', (coalesce(v_profile.exchange_points, 0) - v_cost));
end; $$;
