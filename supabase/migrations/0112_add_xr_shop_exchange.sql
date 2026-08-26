-- XR は交換ショップ最高レアリティ。既存アイテム・所持品には影響しない。
drop function if exists public.buy_item(text, text, text);
create or replace function public.buy_item(
  p_rarity text, p_item_type text, p_item_name text
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_profile record;
  v_cost integer;
  v_item record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  v_cost := case p_rarity
    when 'N' then 5 when 'R' then 15 when 'SR' then 60 when 'SSR' then 240
    when 'UR' then 720 when 'LR' then 2600 when 'XR' then 12000 else null
  end;
  if v_cost is null then raise exception 'Invalid rarity'; end if;

  select * into v_profile from public.profiles where id = v_user_id;
  if v_profile is null or v_profile.exchange_points < v_cost then
    raise exception 'Insufficient points';
  end if;

  select * into v_item from public.gacha_items where name = p_item_name limit 1;
  if v_item is null then
    insert into public.gacha_items (name, rarity, category)
    values (p_item_name, p_rarity, p_item_type)
    returning * into v_item;
  end if;

  insert into public.user_items (user_id, item_id)
  values (v_user_id, v_item.id)
  on conflict (user_id, item_id) do nothing;
  update public.profiles set exchange_points = exchange_points - v_cost where id = v_user_id;
  return json_build_object('item', row_to_json(v_item), 'remaining_points', v_profile.exchange_points - v_cost);
end;
$$;
