create or replace function combine_items(
  p_item_id_a integer,
  p_item_id_b integer,
  p_order text default 'normal'
) returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_item_a record;
  v_item_b record;
  v_rarity_val integer;
  v_new_rarity text;
  v_left text;
  v_right text;
  v_full_title text;
  v_new_item record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_item_id_a = p_item_id_b then
    raise exception 'Cannot combine item with itself';
  end if;

  select g.* into v_item_a from gacha_items g
    join user_items ui on ui.item_id = g.id
    where g.id = p_item_id_a and ui.user_id = v_user_id;

  select g.* into v_item_b from gacha_items g
    join user_items ui on ui.item_id = g.id
    where g.id = p_item_id_b and ui.user_id = v_user_id;

  if v_item_a is null or v_item_b is null then
    raise exception 'Item not found or not owned';
  end if;

  v_rarity_val := greatest(
    case v_item_a.rarity when 'N' then 1 when 'R' then 2 when 'SR' then 3 when 'SSR' then 4 when 'UR' then 5 when 'LR' then 6 else 1 end,
    case v_item_b.rarity when 'N' then 1 when 'R' then 2 when 'SR' then 3 when 'SSR' then 4 when 'UR' then 5 when 'LR' then 6 else 1 end
  );

  v_new_rarity := case v_rarity_val
    when 1 then 'N' when 2 then 'R' when 3 then 'SR'
    when 4 then 'SSR' when 5 then 'UR' when 6 then 'LR'
  end;

  if p_order = 'reverse' then
    v_left := v_item_b.name; v_right := v_item_a.name;
  else
    v_left := v_item_a.name; v_right := v_item_b.name;
  end if;

  v_full_title := left('精錬:' || v_left || v_right, 95);

  select * into v_new_item from gacha_items where name = v_full_title limit 1;
  if v_new_item is null then
    insert into gacha_items (name, rarity, category)
    values (v_full_title, v_new_rarity, 'title')
    returning * into v_new_item;
  end if;

  insert into user_items (user_id, item_id) values (v_user_id, v_new_item.id);
  update profiles set current_title_id = v_new_item.id where id = v_user_id;

  return json_build_object('item', row_to_json(v_new_item));
end;
$$;

create or replace function refine_parts(
  p_word text,
  p_noun text,
  p_name_part text,
  p_order text default 'normal'
) returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_full_title text;
  v_rarity_val integer := 1;
  v_new_item record;
  v_all_items json;
  v_item json;
  v_part_rarity integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_order = 'name_first' then
    v_full_title := left(coalesce(p_name_part, '') || coalesce(p_word, '') || coalesce(p_noun, ''), 47);
  elsif p_order = 'noun_first' then
    v_full_title := left(coalesce(p_noun, '') || coalesce(p_word, '') || coalesce(p_name_part, ''), 47);
  else
    v_full_title := left(coalesce(p_word, '') || coalesce(p_noun, '') || coalesce(p_name_part, ''), 47);
  end if;

  v_full_title := '精錬:' || v_full_title;

  for v_item in select g.* from user_items ui join gacha_items g on g.id = ui.item_id
    where ui.user_id = v_user_id
  loop
    if p_word is not null and (v_item->>'name') like '%' || p_word || '%' then
      v_part_rarity := case v_item->>'rarity'
        when 'N' then 1 when 'R' then 2 when 'SR' then 3
        when 'SSR' then 4 when 'UR' then 5 when 'LR' then 6 else 1
      end;
      v_rarity_val := greatest(v_rarity_val, v_part_rarity);
    end if;
    if p_noun is not null and (v_item->>'name') like '%' || p_noun || '%' then
      v_part_rarity := case v_item->>'rarity'
        when 'N' then 1 when 'R' then 2 when 'SR' then 3
        when 'SSR' then 4 when 'UR' then 5 when 'LR' then 6 else 1
      end;
      v_rarity_val := greatest(v_rarity_val, v_part_rarity);
    end if;
    if p_name_part is not null and (v_item->>'name') like '%' || p_name_part || '%' then
      v_part_rarity := case v_item->>'rarity'
        when 'N' then 1 when 'R' then 2 when 'SR' then 3
        when 'SSR' then 4 when 'UR' then 5 when 'LR' then 6 else 1
      end;
      v_rarity_val := greatest(v_rarity_val, v_part_rarity);
    end if;
  end loop;

  select * into v_new_item from gacha_items where name = v_full_title limit 1;
  if v_new_item is null then
    insert into gacha_items (name, rarity, category, created_at)
    values (
      v_full_title,
      case v_rarity_val when 1 then 'N' when 2 then 'R' when 3 then 'SR' when 4 then 'SSR' when 5 then 'UR' when 6 then 'LR' end,
      'title',
      now()
    )
    returning * into v_new_item;
  end if;

  insert into user_items (user_id, item_id) values (v_user_id, v_new_item.id);
  update profiles set current_title_id = v_new_item.id where id = v_user_id;

  return json_build_object('item', row_to_json(v_new_item));
end;
$$;
