-- 実績文字は、未解放のものだけ 1文字 10,000ポイントで交換できる。
-- 実績での無料解放はこれまでどおり維持する。

create or replace function public.purchase_title_character(p_definition_id text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_points integer := 0;
  v_character text;
  v_price constant integer := 10000;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  select character into v_character
    from public.title_character_definitions
   where id = p_definition_id;
  if v_character is null then raise exception 'その文字は見つかりません'; end if;

  if exists (
    select 1 from public.user_title_characters
     where user_id = v_user_id and definition_id = p_definition_id
  ) then
    raise exception 'この文字はすでに解放済みです';
  end if;

  select coalesce(exchange_points, 0) into v_points
    from public.profiles
   where id = v_user_id
   for update;
  if v_points < v_price then
    raise exception 'ポイントが足りません（必要: %P / 所持: %P）', v_price, v_points;
  end if;

  update public.profiles
     set exchange_points = coalesce(exchange_points, 0) - v_price
   where id = v_user_id;

  insert into public.user_title_characters (user_id, definition_id)
  values (v_user_id, p_definition_id);

  return json_build_object('character', v_character, 'spent_points', v_price, 'remaining_points', v_points - v_price);
end;
$$;

grant execute on function public.purchase_title_character(text) to authenticated;
