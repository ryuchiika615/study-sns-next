-- Free keeps all core learning and social features. These limits apply only
-- when creating additional planning items; existing user data is untouched.

create or replace function public.enforce_free_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  allowed boolean;
  item_label text;
  item_limit integer;
begin
  select exists (
    select 1 from public.pro_grants
    where user_id = new.user_id
      and revoked_at is null
      and starts_at <= now()
      and (expires_at is null or expires_at > now())
  ) into allowed;

  if allowed then return new; end if;

  if tg_table_name = 'todos' then
    item_label := 'タスク'; item_limit := 5;
    select count(*) into current_count from public.todos where user_id = new.user_id;
  elsif tg_table_name = 'textbooks' then
    item_label := '教材'; item_limit := 3;
    select count(*) into current_count from public.textbooks where user_id = new.user_id;
  else
    return new;
  end if;

  if current_count >= item_limit then
    raise exception 'FREEプランでは%は%件までです。Proで無制限にできます。', item_label, item_limit
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_free_todo_limit on public.todos;
create trigger enforce_free_todo_limit before insert on public.todos
  for each row execute function public.enforce_free_plan_limit();

drop trigger if exists enforce_free_textbook_limit on public.textbooks;
create trigger enforce_free_textbook_limit before insert on public.textbooks
  for each row execute function public.enforce_free_plan_limit();
