-- Security definer function for admin to delete any posts (bypasses RLS)
create or replace function admin_delete_posts(p_post_ids uuid[])
returns void
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin = true) then
    raise exception 'Not authorized';
  end if;
  delete from posts where id = any(p_post_ids);
end;
$$;
