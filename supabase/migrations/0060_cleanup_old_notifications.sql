-- 古い既読通知を削除する関数（デフォルト30日より前）
create or replace function cleanup_old_notifications(days_old integer default 30)
returns integer
language plpgsql
security definer
as $$
declare
  deleted_count integer;
begin
  delete from notifications
  where is_read = true
    and created_at < now() - (days_old || ' days')::interval
    and notification_type != 'admin_announcement';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
