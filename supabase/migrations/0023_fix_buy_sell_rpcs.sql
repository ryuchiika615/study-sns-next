-- Fix buy_item and sell_items RPCs: handle missing user_items.id gracefully

-- Fix buy_item
drop function if exists buy_item(text, text, text);
create or replace function buy_item(
  p_rarity text,
  p_item_type text,
  p_item_name text
) returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_profile record;
  v_cost integer;
  v_item record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  v_cost := case p_rarity when 'N' then 5 when 'R' then 15 when 'SR' then 60 when 'SSR' then 240 when 'UR' then 720 when 'LR' then 2600 else null end;
  if v_cost is null then raise exception 'Invalid rarity'; end if;
  select * into v_profile from profiles where id = v_user_id;
  if v_profile is null or v_profile.exchange_points < v_cost then raise exception 'Insufficient points'; end if;
  select * into v_item from gacha_items where name = p_item_name limit 1;
  if v_item is null then
    insert into gacha_items (name, rarity, category) values (p_item_name, p_rarity, p_item_type) returning * into v_item;
  end if;
  -- Insert only if not already owned (dedup)
  insert into user_items (user_id, item_id)
  select v_user_id, v_item.id
  where not exists (select 1 from user_items where user_id = v_user_id and item_id = v_item.id);
  update profiles set exchange_points = exchange_points - v_cost where id = v_user_id;
  return json_build_object('item', row_to_json(v_item), 'remaining_points', (coalesce(v_profile.exchange_points, 0) - v_cost));
end;
$$;

-- Fix sell_items: use uuid[] instead of integer[]
drop function if exists sell_items(integer[], text);
create or replace function sell_items(
  p_item_ids uuid[],
  p_max_rarity text default null
) returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_profile record;
  v_ids_to_delete uuid[] := '{}';
  v_total_points integer := 0;
  v_rec record;
  v_rarity_val integer;
  v_sell_val integer;
  v_max_val integer;
  v_is_refined boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  select * into v_profile from profiles where id = v_user_id;
  if v_profile is null then raise exception 'Profile not found'; end if;
  if p_max_rarity is not null then
    v_max_val := case p_max_rarity when 'N' then 1 when 'R' then 2 when 'SR' then 3 when 'SSR' then 4 when 'UR' then 5 when 'LR' then 6 else 0 end;
    for v_rec in select g.id, g.name, g.rarity from user_items ui join gacha_items g on g.id = ui.item_id where ui.user_id = v_user_id loop
      v_rarity_val := case v_rec.rarity when 'N' then 1 when 'R' then 2 when 'SR' then 3 when 'SSR' then 4 when 'UR' then 5 when 'LR' then 6 else 1 end;
      v_is_refined := v_rec.name like '精錬:%' or v_rec.name like '邊ｾ骭ｬ:%';
      if v_rarity_val <= v_max_val and not v_is_refined and v_rec.id != v_profile.current_title_id and v_rec.id != v_profile.current_avatar_id then
        v_ids_to_delete := array_append(v_ids_to_delete, v_rec.id);
        v_sell_val := case v_rec.rarity when 'N' then 1 when 'R' then 4 when 'SR' then 15 when 'SSR' then 60 when 'UR' then 180 when 'LR' then 650 else 0 end;
        v_total_points := v_total_points + v_sell_val;
      end if;
    end loop;
  elsif array_length(p_item_ids, 1) > 0 then
    for v_rec in select g.id, g.name, g.rarity from user_items ui join gacha_items g on g.id = ui.item_id where ui.user_id = v_user_id and ui.item_id = any(p_item_ids) loop
      v_is_refined := v_rec.name like '精錬:%' or v_rec.name like '邊ｾ骭ｬ:%';
      if not v_is_refined and v_rec.id != v_profile.current_title_id and v_rec.id != v_profile.current_avatar_id then
        v_ids_to_delete := array_append(v_ids_to_delete, v_rec.id);
        v_sell_val := case v_rec.rarity when 'N' then 1 when 'R' then 4 when 'SR' then 15 when 'SSR' then 60 when 'UR' then 180 when 'LR' then 650 else 0 end;
        v_total_points := v_total_points + v_sell_val;
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
