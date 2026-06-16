-- 管理者用: RLSをバイパスして投稿を削除 (API Routeでの管理者チェック済み)
create or replace function admin_delete_posts(p_post_ids uuid[])
returns void
language plpgsql
security definer
as $$
begin
  delete from posts where id = any(p_post_ids);
end;
$$;
